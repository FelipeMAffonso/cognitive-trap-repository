/* ========================================
   Cognitive Trap Repository — App Logic
   Three layers: Humans, Models, Agents
   Contribution tracking per data row
   ======================================== */

(function () {
  "use strict";

  var allTraps = [];
  var activeFilter = "all";
  var activeSort = "discrimination";
  var searchQuery = "";
  var activeContributor = "all"; // modal-level source filter

  // ---- Load ----
  fetch("traps.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allTraps = data;
      initFilters();
      initSort();
      updateStats();
      render();
    })
    .catch(function (err) { console.error("Failed to load traps.json:", err); });

  // ---- Search ----
  var searchInput = document.getElementById("search");
  var debounceTimer;
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        searchQuery = searchInput.value.trim().toLowerCase();
        render();
      }, 200);
    });
  }

  // ---- Filters ----
  function initFilters() {
    var filtersEl = document.getElementById("filters");
    if (!filtersEl) return;
    var cats = [];
    allTraps.forEach(function (t) { if (cats.indexOf(t.category) === -1) cats.push(t.category); });
    cats.sort();
    cats.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "filter-btn";
      btn.dataset.filter = cat;
      btn.textContent = cat;
      btn.addEventListener("click", function () { setFilter(cat); });
      filtersEl.appendChild(btn);
    });
    filtersEl.querySelector('[data-filter="all"]').addEventListener("click", function () { setFilter("all"); });
  }

  function setFilter(f) {
    activeFilter = f;
    document.querySelectorAll(".filter-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.filter === f);
    });
    render();
  }

  // ---- Sort ----
  function initSort() {
    var sortEl = document.getElementById("sort-options");
    if (!sortEl) return;
    sortEl.querySelectorAll(".sort-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeSort = btn.dataset.sort;
        sortEl.querySelectorAll(".sort-btn").forEach(function (b) {
          b.classList.toggle("active", b.dataset.sort === activeSort);
        });
        render();
      });
    });
  }

  function sortTraps(list) {
    return list.slice().sort(function (a, b) {
      var valA, valB;
      switch (activeSort) {
        case "discrimination":
          valA = getPooled(a).discriminationPP;
          valB = getPooled(b).discriminationPP;
          return valB - valA;
        case "agent-fail":
          valA = getPooled(a).agentFailRate;
          valB = getPooled(b).agentFailRate;
          return valB - valA;
        case "human-pass":
          valA = getPooled(a).humanPassRate;
          valB = getPooled(b).humanPassRate;
          return valB - valA;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }

  // ---- Pooled Stats (computed from ALL evidence) ----
  function getPooled(t) {
    var hNum = 0, hDen = 0;
    if (t.humanStudies) {
      t.humanStudies.forEach(function (h) {
        hNum += h.passRate * h.sampleSize;
        hDen += h.sampleSize;
      });
    }
    var humanPassRate = hDen > 0 ? hNum / hDen : null;
    var humanN = hDen;

    var agentFailRate = null;
    var agentN = 0;
    if (t.pooledAgentResults) {
      agentFailRate = t.pooledAgentResults.failureRate;
      agentN = t.pooledAgentResults.sampleSize;
    }

    var modelFailRate = null;
    if (t.modelTests && t.modelTests.length > 0) {
      var mSum = 0;
      t.modelTests.forEach(function (m) { mSum += m.passRate; });
      modelFailRate = 1 - (mSum / t.modelTests.length);
    }

    // Always compute discrimination dynamically from data
    var discriminationPP = 0;
    var effectiveFailRate = agentFailRate !== null ? agentFailRate : modelFailRate;
    if (effectiveFailRate !== null && humanPassRate !== null) {
      discriminationPP = (effectiveFailRate - (1 - humanPassRate)) * 100;
    }

    // Chi-square: 2x2 contingency table (AI/human x pass/fail)
    var chiSq = null;
    var aiN = agentFailRate !== null ? agentN : 0;
    if (aiN === 0 && t.modelTests && t.modelTests.length > 0) {
      t.modelTests.forEach(function (m) { aiN += m.trials; });
    }
    if (effectiveFailRate !== null && humanPassRate !== null && aiN > 0 && humanN > 0) {
      var a = Math.round(effectiveFailRate * aiN);
      var b = aiN - a;
      var c = Math.round((1 - humanPassRate) * humanN);
      var d = humanN - c;
      var total = a + b + c + d;
      var denom = (a + b) * (c + d) * (a + c) * (b + d);
      if (denom > 0) chiSq = total * Math.pow(a * d - b * c, 2) / denom;
    }

    return {
      humanPassRate: humanPassRate !== null ? humanPassRate : 0,
      humanN: humanN,
      agentFailRate: agentFailRate !== null ? agentFailRate : (modelFailRate !== null ? modelFailRate : 0),
      agentN: agentN,
      modelFailRate: modelFailRate,
      discriminationPP: discriminationPP,
      chiSq: chiSq,
      hasAgentData: agentFailRate !== null,
      hasHumanData: humanPassRate !== null,
      hasModelData: modelFailRate !== null
    };
  }

  // ---- Stats Bar ----
  function updateStats() {
    animNum("stat-traps", allTraps.length);

    // Unique LLM models (base models tested via API/chat)
    var models = [];
    allTraps.forEach(function (t) {
      if (t.modelTests) t.modelTests.forEach(function (m) {
        if (models.indexOf(m.model) === -1) models.push(m.model);
      });
    });
    animNum("stat-models", models.length);

    // Unique agent platforms (autonomous agents deployed in real surveys)
    var agents = [];
    allTraps.forEach(function (t) {
      if (t.agentTests) t.agentTests.forEach(function (a) {
        if (agents.indexOf(a.agent) === -1) agents.push(a.agent);
      });
    });
    animNum("stat-agents", agents.length);

    // Human participants: deduplicate within-subjects designs using cohortId
    // Studies sharing a cohortId tested the same participants across traps
    var seenCohorts = {};
    allTraps.forEach(function (t) {
      if (t.humanStudies) t.humanStudies.forEach(function (h) {
        var key = h.cohortId || (h.platform + "|" + h.source + "|" + h.sampleSize);
        if (!seenCohorts[key]) {
          seenCohorts[key] = h.sampleSize;
        }
      });
    });
    var humansTested = 0;
    Object.keys(seenCohorts).forEach(function (k) { humansTested += seenCohorts[k]; });
    animNum("stat-humans", humansTested);
  }

  function animNum(id, target) {
    var el = document.getElementById(id);
    if (!el) return;
    if (target === 0) { el.textContent = "0"; return; }
    var cur = 0;
    var step = Math.max(1, Math.floor(target / 15));
    var iv = setInterval(function () {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(iv); }
      el.textContent = cur.toLocaleString();
    }, 40);
  }

  // ---- Render Cards ----
  function render() {
    var grid = document.getElementById("trap-grid");
    var empty = document.getElementById("empty-state");
    var count = document.getElementById("results-count");
    if (!grid) return;

    var filtered = allTraps.filter(function (t) {
      if (activeFilter !== "all" && t.category !== activeFilter) return false;
      if (searchQuery) {
        var hay = [t.name, t.category, t.description, t.constraintExploited, t.question].join(" ").toLowerCase();
        if (t.modelTests) t.modelTests.forEach(function (m) { hay += " " + m.model.toLowerCase(); });
        if (t.agentTests) t.agentTests.forEach(function (a) { hay += " " + a.agent.toLowerCase(); });
        if (t.contributions) t.contributions.forEach(function (c) { hay += " " + c.contributor.toLowerCase(); });
        if (hay.indexOf(searchQuery) === -1) return false;
      }
      return true;
    });

    filtered = sortTraps(filtered);

    if (count) {
      count.textContent = filtered.length + " trap" + (filtered.length !== 1 ? "s" : "") +
        (activeFilter !== "all" ? " in " + activeFilter : "") +
        (searchQuery ? ' matching "' + searchQuery + '"' : "");
    }

    if (filtered.length === 0) {
      grid.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    grid.innerHTML = filtered.map(cardHtml).join("");
    grid.querySelectorAll(".trap-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var trap = allTraps.find(function (t) { return t.id === card.dataset.id; });
        if (trap) openModal(trap);
      });
    });
  }

  function cardHtml(t) {
    var img = t.image
      ? '<img class="trap-card-image" src="' + t.image + '" alt="' + esc(t.name) + '"' +
        ' onerror="this.outerHTML=\'<div class=trap-card-image-placeholder>' + esc(t.name) + '</div>\'">'
      : '<div class="trap-card-image-placeholder">No image</div>';

    var p = getPooled(t);
    var stats = "";

    if (p.hasAgentData) {
      stats = '<div class="trap-stats">' +
        mkStat(pct(p.agentFailRate), "Agent Fail", "good") +
        mkStat(pct(p.humanPassRate), "Human Pass", "good") +
        mkStat(p.discriminationPP.toFixed(1) + "pp", "Discrim.", "neutral") +
        '</div>';
    } else if (p.hasModelData && p.hasHumanData) {
      stats = '<div class="trap-stats">' +
        mkStat(pct(p.modelFailRate), "Model Fail", "neutral") +
        mkStat(pct(p.humanPassRate), "Human Pass", p.humanPassRate >= 0.75 ? "good" : "warn") +
        mkStat("N=" + p.humanN, "Humans", "neutral") +
        '</div>';
    } else if (p.hasHumanData) {
      stats = '<div class="trap-stats">' +
        mkStat(pct(p.humanPassRate), "Human Pass", p.humanPassRate >= 0.75 ? "good" : "warn") +
        mkStat("N=" + p.humanN, "Humans", "neutral") +
        mkStat("--", "Agent Fail", "muted") +
        '</div>';
    } else {
      stats = '<div class="trap-stat-na">No data yet</div>';
    }

    // Contribution count badge on card
    var contribCount = t.contributions ? t.contributions.length : 0;
    var contribBadge = contribCount > 1
      ? '<span class="badge badge-contrib">' + contribCount + ' sources</span>'
      : '';

    return '<div class="trap-card" data-id="' + t.id + '">' + img +
      '<div class="trap-card-body">' +
        '<div class="trap-card-name">' + esc(t.name) + '</div>' +
        '<div class="trap-card-badges">' +
          '<span class="badge badge-category">' + esc(t.category) + '</span>' +
          contribBadge +
        '</div>' +
        '<p class="trap-card-description">' + esc(t.description) + '</p>' +
        stats +
      '</div></div>';
  }

  // ---- Contribution Helpers ----
  function getContributors(t) {
    if (!t.contributions) return [];
    return t.contributions.slice().sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });
  }

  function getContributorColor(index) {
    var colors = ["#DA7756", "#5B8DEF", "#24b47e", "#9b59b6", "#e67e22", "#1abc9c"];
    return colors[index % colors.length];
  }

  // ---- Modal ----
  function openModal(t) {
    var overlay = document.getElementById("modal-overlay");
    var modal = document.getElementById("modal");
    if (!overlay || !modal) return;

    activeContributor = "all";
    var p = getPooled(t);
    var contributors = getContributors(t);
    var hasMultiple = contributors.length > 1;

    // Response options
    var optsHtml = "";
    if (t.responseOptions && t.responseOptions.length > 0) {
      optsHtml = '<ul class="options-list">';
      t.responseOptions.forEach(function (opt) {
        var correct = opt === t.correctAnswer;
        optsHtml += '<li class="' + (correct ? "correct" : "") + '">' +
          (correct ? "\u2713 " : "\u00A0\u00A0 ") + esc(opt) + '</li>';
      });
      optsHtml += '</ul>';
    }

    // ---- Source filter chips (only when multiple contributors) ----
    var sourceFilterHtml = "";
    if (hasMultiple) {
      sourceFilterHtml = '<div class="modal-section">' +
        '<div class="modal-section-title">Filter by Source</div>' +
        '<div class="source-chips" id="source-chips">' +
          '<button class="source-chip active" data-contrib="all">All Sources</button>';
      contributors.forEach(function (c, i) {
        sourceFilterHtml += '<button class="source-chip" data-contrib="' + esc(c.id) + '" style="--chip-color:' + getContributorColor(i) + '">' +
          esc(c.contributor) + '</button>';
      });
      sourceFilterHtml += '</div></div>';
    }

    // ---- Pooled Summary Stats ----
    var summaryHtml = "";
    if (p.hasAgentData || p.hasModelData) {
      var failLabel = p.hasAgentData ? "Pooled Agent Failure" : "Avg Model Failure";
      var failVal = p.hasAgentData ? p.agentFailRate : p.modelFailRate;
      var failSub = p.hasAgentData ? "N=" + p.agentN + " agents" : t.modelTests.length + " models";
      var discrimVal = p.hasHumanData ? p.discriminationPP.toFixed(1) + "pp" : "--";
      var discrimSub = "";
      var discrimCls = "neutral";
      if (!p.hasHumanData) {
        discrimSub = "Requires human data";
        discrimCls = "muted";
      } else if (p.chiSq !== null) {
        discrimSub = "\u03C7\u00B2=" + p.chiSq.toFixed(1) + ", p<.001";
      }
      summaryHtml = '<div class="modal-section">' +
        '<div class="modal-section-title">Summary</div>' +
        '<div class="modal-stats">' +
          mStat(pct(failVal), failLabel, failSub, "good") +
          mStat(p.hasHumanData ? pct(p.humanPassRate) : "--", "Human Pass Rate", p.hasHumanData ? "N=" + p.humanN + " humans" : "No data", p.hasHumanData ? "good" : "muted") +
          mStat(discrimVal, "Discrimination", discrimSub, discrimCls, "discrim") +
        '</div></div>';
    }

    // ---- Layer 1: Human Studies ----
    var humanHtml = "";
    if (t.humanStudies && t.humanStudies.length > 0) {
      humanHtml = '<div class="modal-section" data-layer="human">' +
        '<div class="modal-section-title">Human Performance</div>' +
        '<table class="model-table"><thead><tr>' +
          '<th>Study</th><th>Pass Rate</th><th>N</th><th>Platform</th>' +
          (hasMultiple ? '<th>Source</th>' : '') +
        '</tr></thead><tbody>';
      t.humanStudies.forEach(function (h) {
        var cId = h.contributionId || "";
        var cIndex = contributors.findIndex(function (c) { return c.id === cId; });
        var srcTag = hasMultiple ? '<td><span class="source-tag" style="background:' + getContributorColor(cIndex) + '">' + shortContrib(h.source) + '</span></td>' : '';
        humanHtml += '<tr data-contribution="' + esc(cId) + '">' +
          '<td>' + esc(h.label) + '</td>' +
          '<td><span class="rate ' + (h.passRate >= 0.75 ? 'rate-high' : 'rate-low') + '">' + pct(h.passRate) + '</span></td>' +
          '<td>' + h.sampleSize + '</td>' +
          '<td>' + esc(h.platform) + '</td>' +
          srcTag +
        '</tr>';
      });
      humanHtml += '</tbody></table></div>';
    }

    // ---- Layer 2: Base Model Tests ----
    var modelHtml = "";
    if (t.modelTests && t.modelTests.length > 0) {
      var sortedModels = t.modelTests.slice().sort(function (a, b) {
        return b.passRate - a.passRate;
      });
      var hasProvider = sortedModels.some(function (m) { return m.provider; });

      // Compute summary stats
      var totalTrials = 0;
      var zeroCount = 0;
      var passSum = 0;
      var providers = {};
      sortedModels.forEach(function (m) {
        totalTrials += m.trials;
        passSum += m.passRate;
        if (m.passRate === 0) zeroCount++;
        if (m.provider) providers[m.provider] = (providers[m.provider] || 0) + 1;
      });
      var avgPass = (passSum / sortedModels.length * 100).toFixed(1);
      var zeroPct = Math.round(zeroCount / sortedModels.length * 100);

      // Separate initial validation (chat) from extended validation (API)
      var initialModels = sortedModels.filter(function (m) { return m.method === "Chat Interface"; });
      var extendedModels = sortedModels.filter(function (m) { return m.method !== "Chat Interface"; });

      modelHtml = '<div class="modal-section" data-layer="model">' +
        '<div class="modal-section-title">Base Model Testing</div>' +
        '<div class="model-summary-bar">' +
          '<span class="model-summary-item">' + sortedModels.length + ' models</span>' +
          '<span class="model-summary-item">' + totalTrials + ' trials</span>' +
          '<span class="model-summary-item">' + zeroPct + '% score 0%</span>' +
          '<span class="model-summary-item">Avg: ' + avgPass + '%</span>' +
        '</div>';

      // Provider filter chips
      if (hasProvider) {
        var provList = Object.keys(providers).sort();
        modelHtml += '<div class="model-filters" id="model-provider-filter">' +
          '<button class="provider-chip active" data-provider="all">All (' + sortedModels.length + ')</button>';
        provList.forEach(function (prov) {
          var cls = prov === "Anthropic" ? "chip-anthropic" : prov === "OpenAI" ? "chip-openai" : prov === "Google" ? "chip-google" : "";
          modelHtml += '<button class="provider-chip ' + cls + '" data-provider="' + esc(prov) + '">' + esc(prov) + ' (' + providers[prov] + ')</button>';
        });
        modelHtml += '</div>';
      }

      // Build model table with sortable headers
      modelHtml += '<table class="model-table" id="model-table"><thead><tr>' +
        '<th class="sortable" data-sort-key="model">Model <span class="sort-arrow"></span></th>' +
        (hasProvider ? '<th class="sortable" data-sort-key="provider">Provider <span class="sort-arrow"></span></th>' : '') +
        '<th>Study</th>' +
        '<th class="sortable active-sort desc" data-sort-key="passRate">Pass Rate <span class="sort-arrow">\u25BC</span></th>' +
        '<th>Trials</th><th></th>' +
      '</tr></thead><tbody>';

      sortedModels.forEach(function (m) {
        var pr = Math.round(m.passRate * 100);
        var rc = pr === 0 ? "rate-zero" : pr <= 30 ? "rate-low" : "rate-high";
        var cId = m.contributionId || "";
        var providerTag = "";
        if (hasProvider) {
          var prov = m.provider || "";
          var provCls = prov === "Anthropic" ? "provider-anthropic" : prov === "OpenAI" ? "provider-openai" : prov === "Google" ? "provider-google" : "";
          providerTag = '<td><span class="provider-badge ' + provCls + '">' + esc(prov) + '</span></td>';
        }
        var studyLabel = m.method === "Chat Interface" ? "Initial" : "Extended";
        var studyCls = m.method === "Chat Interface" ? "study-initial" : "study-extended";
        modelHtml += '<tr data-contribution="' + esc(cId) + '" data-provider="' + esc(m.provider || '') + '" data-pass-rate="' + m.passRate + '" data-model="' + esc(m.model) + '">' +
          '<td>' + esc(m.model) + '</td>' +
          providerTag +
          '<td><span class="study-badge ' + studyCls + '">' + studyLabel + '</span></td>' +
          '<td><span class="rate ' + rc + '">' + pr + '%</span></td>' +
          '<td>' + m.trials + '</td>' +
          '<td class="pass-bar-cell"><div class="pass-bar"><div class="pass-bar-fill" style="width:' + pr + '%"></div></div></td>' +
        '</tr>';
      });

      modelHtml += '</tbody></table>' +
        '<p style="font-size:11px;color:var(--gray-500);margin-top:4px;">\u2020 = extended thinking variant. ' +
        'Initial = chat interface validation (6 models). Extended = API validation (' + extendedModels.length + ' models, 10 trials each).</p>' +
        '</div>';
    }

    // ---- Layer 3: Agent Deployment ----
    var agentHtml = "";
    if (t.agentTests && t.agentTests.length > 0) {
      var totalAgentTrials = 0;
      t.agentTests.forEach(function (a) { totalAgentTrials += a.sampleSize; });
      var pooledFail = t.pooledAgentResults ? t.pooledAgentResults.failureRate : null;

      agentHtml = '<div class="modal-section" data-layer="agent">' +
        '<div class="modal-section-title">Autonomous Agent Deployment (Real Survey)</div>' +
        '<div class="agent-summary-bar">' +
          '<span class="agent-summary-item">' + t.agentTests.length + ' agent platforms</span>' +
          '<span class="agent-summary-item">' + totalAgentTrials + ' total deployments</span>' +
          (pooledFail !== null ? '<span class="agent-summary-item agent-fail-highlight">Pooled failure: ' + (pooledFail * 100).toFixed(1) + '%</span>' : '') +
        '</div>' +
        '<table class="model-table"><thead><tr>' +
          '<th>Agent Platform</th><th>Deployments</th>' +
          (hasMultiple ? '<th>Source</th>' : '') +
        '</tr></thead><tbody>';
      t.agentTests.forEach(function (a) {
        var cId = a.contributionId || "";
        var cIndex = contributors.findIndex(function (c) { return c.id === cId; });
        var srcTag = hasMultiple ? '<td><span class="source-tag" style="background:' + getContributorColor(cIndex) + '">' + shortContrib(a.source) + '</span></td>' : '';
        agentHtml += '<tr data-contribution="' + esc(cId) + '">' +
          '<td>' + esc(a.agent) + '</td>' +
          '<td>' + a.sampleSize + '</td>' +
          srcTag +
        '</tr>';
      });
      agentHtml += '</tbody></table>';

      // Model vs Agent trial comparison
      var modelTrials = 0;
      if (t.modelTests) t.modelTests.forEach(function (m) { modelTrials += m.trials; });
      if (modelTrials > 0) {
        agentHtml += '<div class="trial-comparison">' +
          '<span class="trial-comparison-label">Trial breakdown:</span> ' +
          '<span class="trial-comparison-item"><span class="trial-dot model-dot"></span>' + modelTrials + ' model trials (API)</span>' +
          '<span class="trial-comparison-item"><span class="trial-dot agent-dot"></span>' + totalAgentTrials + ' agent deployments (real survey)</span>' +
        '</div>';
      }
      agentHtml += '</div>';
    }

    // ---- Source Papers ----
    var srcHtml = "";
    if (t.sourcePapers && t.sourcePapers.length > 0) {
      srcHtml = '<div class="modal-section">' +
        '<div class="modal-section-title">Source Papers</div>' +
        '<ul class="source-list">' +
        t.sourcePapers.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") +
        '</ul></div>';
    }

    // ---- Contribution History Timeline ----
    var timelineHtml = "";
    if (contributors.length > 0) {
      timelineHtml = '<div class="modal-section contrib-timeline-section">' +
        '<div class="modal-section-title">Contribution History</div>' +
        '<div class="contrib-timeline">';
      contributors.forEach(function (c, i) {
        var typeLabel = c.type === "original" ? "Original submission" :
          c.type === "model-data" ? "Model testing data" :
          c.type === "human-data" ? "Human validation data" :
          c.type === "agent-data" ? "Agent deployment data" :
          "Data contribution";
        timelineHtml += '<div class="contrib-entry">' +
          '<div class="contrib-dot" style="background:' + getContributorColor(i) + '"></div>' +
          '<div class="contrib-content">' +
            '<div class="contrib-header">' +
              '<span class="contrib-name">' + esc(c.contributor) + '</span>' +
              '<span class="contrib-date">' + esc(c.date) + '</span>' +
            '</div>' +
            '<div class="contrib-type">' + typeLabel + '</div>' +
            (c.description ? '<div class="contrib-desc">' + esc(c.description) + '</div>' : '') +
          '</div>' +
        '</div>';
      });
      timelineHtml += '</div></div>';
    }

    // ---- Assemble Modal ----
    modal.innerHTML =
      '<button class="modal-close" id="modal-close">&times;</button>' +

      '<div class="modal-image-section">' +
        (t.image ? '<img class="modal-image" src="' + t.image + '" alt="' + esc(t.name) + '">' : '') +
        '<div class="modal-download-bar">' +
          (t.image ? '<a href="' + t.image + '" download class="btn btn-primary btn-sm">\u2B07 Download Stimulus</a>' : '') +
          '<button class="btn btn-secondary btn-sm" onclick="copyQuestion(\'' + esc(t.id) + '\')">\u2398 Copy Question</button>' +
        '</div>' +
      '</div>' +

      '<div class="modal-body">' +
        '<div class="modal-title">' + esc(t.name) + '</div>' +
        '<div class="modal-badges">' +
          '<span class="badge badge-category">' + esc(t.category) + '</span>' +
        '</div>' +
        '<p class="modal-description">' + esc(t.description) + '</p>' +

        summaryHtml +

        '<div class="modal-section">' +
          '<div class="modal-section-title">Question &amp; Answer</div>' +
          '<div class="question-box" id="qbox-' + t.id + '">' +
            '<p><strong>Q:</strong> ' + esc(t.question) + '</p>' +
            optsHtml +
            '<p style="margin-top:8px;"><strong>Correct:</strong> <span class="answer">' + esc(t.correctAnswer) + '</span></p>' +
          '</div>' +
        '</div>' +

        '<div class="modal-section">' +
          '<div class="modal-section-title">Constraint Exploited</div>' +
          '<p style="font-size:13px;color:var(--gray-600);line-height:1.6;">' + esc(t.constraintExploited) + '</p>' +
        '</div>' +

        // Source filter (only when multiple contributors)
        sourceFilterHtml +

        // Three data layers
        humanHtml +
        modelHtml +
        agentHtml +

        srcHtml +
        timelineHtml +
      '</div>';

    overlay.classList.add("open");
    document.body.style.overflow = "hidden";

    document.getElementById("modal-close").addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", escKey);

    // Wire up source filter chips
    if (hasMultiple) {
      var chips = document.getElementById("source-chips");
      if (chips) {
        chips.querySelectorAll(".source-chip").forEach(function (chip) {
          chip.addEventListener("click", function () {
            activeContributor = chip.dataset.contrib;
            chips.querySelectorAll(".source-chip").forEach(function (c) {
              c.classList.toggle("active", c.dataset.contrib === activeContributor);
            });
            filterModalRows();
          });
        });
      }
    }

    // Wire up provider filter chips (model table)
    var provFilter = document.getElementById("model-provider-filter");
    if (provFilter) {
      provFilter.querySelectorAll(".provider-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var prov = chip.dataset.provider;
          provFilter.querySelectorAll(".provider-chip").forEach(function (c) {
            c.classList.toggle("active", c.dataset.provider === prov);
          });
          var modelTable = document.getElementById("model-table");
          if (modelTable) {
            modelTable.querySelectorAll("tbody tr").forEach(function (row) {
              row.style.display = (prov === "all" || row.dataset.provider === prov) ? "" : "none";
            });
          }
        });
      });
    }

    // Wire up sortable column headers (model table)
    var modelTable = document.getElementById("model-table");
    if (modelTable) {
      modelTable.querySelectorAll("th.sortable").forEach(function (th) {
        th.style.cursor = "pointer";
        th.addEventListener("click", function () {
          var key = th.dataset.sortKey;
          var wasDesc = th.classList.contains("desc");
          modelTable.querySelectorAll("th.sortable").forEach(function (h) {
            h.classList.remove("active-sort", "asc", "desc");
            var arrow = h.querySelector(".sort-arrow");
            if (arrow) arrow.textContent = "";
          });
          var newDir = wasDesc ? "asc" : "desc";
          th.classList.add("active-sort", newDir);
          var arrow = th.querySelector(".sort-arrow");
          if (arrow) arrow.textContent = newDir === "desc" ? "\u25BC" : "\u25B2";
          var tbody = modelTable.querySelector("tbody");
          var rows = Array.from(tbody.querySelectorAll("tr"));
          rows.sort(function (a, b) {
            var va, vb;
            if (key === "model") {
              va = (a.dataset.model || "").toLowerCase();
              vb = (b.dataset.model || "").toLowerCase();
              return newDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            } else if (key === "provider") {
              va = (a.dataset.provider || "").toLowerCase();
              vb = (b.dataset.provider || "").toLowerCase();
              return newDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            } else if (key === "passRate") {
              va = parseFloat(a.dataset.passRate) || 0;
              vb = parseFloat(b.dataset.passRate) || 0;
              return newDir === "asc" ? va - vb : vb - va;
            }
            return 0;
          });
          rows.forEach(function (row) { tbody.appendChild(row); });
        });
      });
    }

    // Wire up discrimination tooltip (hover to show, stays open while hovering)
    var tooltipTimer = null;
    modal.querySelectorAll(".has-tooltip[data-popover]").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        clearTimeout(tooltipTimer);
        closeTooltip();
        var rect = el.getBoundingClientRect();
        var tip = document.createElement("div");
        tip.className = "stat-tooltip-float";
        tip.id = "active-tooltip";
        tip.innerHTML =
          '<div class="stat-popover-title">How Discrimination Is Calculated</div>' +
          '<div class="stat-popover-formula">Discrimination = AI Failure Rate \u2212 Human Failure Rate</div>' +
          '<p>Measured in percentage points (pp). If agents fail 94.1% and humans fail 7.2%, discrimination = 86.9pp.</p>' +
          '<p>Higher values mean the trap better separates AI from humans.</p>' +
          '<div class="stat-popover-title" style="margin-top:10px">\u03C7\u00B2 (Chi-Square)</div>' +
          '<p>Tests statistical significance via 2\u00D72 contingency table (AI vs. human \u00D7 pass vs. fail).</p>' +
          '<p class="stat-popover-note">All values recompute automatically when new data is submitted.</p>';
        document.body.appendChild(tip);
        // Position: centered below the element, fixed to viewport
        var tipW = 300;
        var left = rect.left + rect.width / 2 - tipW / 2;
        var top = rect.bottom + 10;
        if (left < 8) left = 8;
        if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
        if (top + tip.offsetHeight > window.innerHeight - 8) top = rect.top - tip.offsetHeight - 10;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
        // Keep tooltip open when hovering over it
        tip.addEventListener("mouseenter", function () { clearTimeout(tooltipTimer); });
        tip.addEventListener("mouseleave", function () {
          tooltipTimer = setTimeout(closeTooltip, 200);
        });
      });
      el.addEventListener("mouseleave", function () {
        tooltipTimer = setTimeout(closeTooltip, 200);
      });
    });
  }

  function closeTooltip() {
    var t = document.getElementById("active-tooltip");
    if (t) t.remove();
  }

  function filterModalRows() {
    var modal = document.getElementById("modal");
    if (!modal) return;
    var rows = modal.querySelectorAll("tr[data-contribution]");
    rows.forEach(function (row) {
      if (activeContributor === "all") {
        row.style.opacity = "";
        row.style.display = "";
      } else {
        var match = row.dataset.contribution === activeContributor;
        row.style.opacity = match ? "" : "0.2";
        row.style.display = "";
      }
    });
  }

  function closeModal() {
    closeTooltip();
    var o = document.getElementById("modal-overlay");
    if (o) o.classList.remove("open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escKey);
    activeContributor = "all";
  }
  function escKey(e) { if (e.key === "Escape") closeModal(); }

  // ---- Copy ----
  window.copyQuestion = function (id) {
    var t = allTraps.find(function (x) { return x.id === id; });
    if (!t) return;
    var txt = "Question: " + t.question + "\n";
    if (t.responseOptions && t.responseOptions.length > 0) {
      txt += "\nResponse Options:\n";
      t.responseOptions.forEach(function (opt, i) {
        txt += String.fromCharCode(65 + i) + ") " + opt + (opt === t.correctAnswer ? " *" : "") + "\n";
      });
    }
    txt += "\nCorrect Answer: " + t.correctAnswer;
    navigator.clipboard.writeText(txt).then(function () { toast("Question copied to clipboard"); })
      .catch(function () { toast("Could not copy"); });
  };

  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 2000);
  }

  // ---- Helpers ----
  function mkStat(val, label, cls) {
    return '<div class="trap-stat"><span class="trap-stat-value ' + cls + '">' + val + '</span>' +
      '<span class="trap-stat-label">' + label + '</span></div>';
  }
  function mStat(val, label, sub, cls, popoverId) {
    return '<div class="modal-stat' + (popoverId ? ' has-tooltip' : '') + '"' +
      (popoverId ? ' data-popover="' + popoverId + '"' : '') + '>' +
      '<span class="modal-stat-value ' + cls + '">' + val + '</span>' +
      '<span class="modal-stat-label">' + label + '</span>' +
      (sub ? '<span class="modal-stat-sub">' + sub + '</span>' : '') +
      '</div>';
  }
  function pct(v) { return v !== null ? (v * 100).toFixed(1) + "%" : "--"; }
  function shortContrib(source) {
    if (!source) return "?";
    // "Affonso (2026), Table 3" -> "Affonso (2026)"
    var m = source.match(/^([^,]+)/);
    return m ? m[1].trim() : source;
  }
  function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

})();
