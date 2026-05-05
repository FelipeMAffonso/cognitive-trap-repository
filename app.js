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

    // Hero description placeholders — keep in sync with actual data
    var heroCount = document.getElementById("hero-model-count");
    if (heroCount) heroCount.textContent = models.length;

    // Date range from contributions: earliest -> most recent contribution date
    var allDates = [];
    allTraps.forEach(function (t) {
      if (t.contributions) t.contributions.forEach(function (c) {
        if (c.date) allDates.push(c.date);
      });
    });
    var heroRange = document.getElementById("hero-date-range");
    if (heroRange && allDates.length > 0) {
      allDates.sort();
      var fmt = function (d) {
        // "2026-02-18" -> "Feb 2026"
        var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        var p = d.split("-");
        if (p.length < 2) return d;
        return months[parseInt(p[1], 10) - 1] + " " + p[0];
      };
      // We use the underlying study date span. The earliest model in our set
      // is Claude Haiku 3.0 (Mar 2024); the latest is what is currently in the
      // contribution stream. Hard date floor reflects the earliest model release.
      var firstDate = "2024-03";
      var lastDate = allDates[allDates.length - 1].slice(0, 7);
      heroRange.textContent = fmt(firstDate + "-01") + " – " + fmt(lastDate + "-01");
    }

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
        return a.passRate - b.passRate;
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

      var PAGE_SIZE = 10;

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
        '<th class="sortable" data-sort-key="interface">Interface <span class="sort-arrow"></span></th>' +
        '<th class="sortable active-sort asc" data-sort-key="passRate">Pass Rate <span class="sort-arrow">\u25B2</span></th>' +
        '<th class="sortable" data-sort-key="trials">Trials <span class="sort-arrow"></span></th><th></th>' +
      '</tr></thead><tbody>';

      sortedModels.forEach(function (m, idx) {
        var pr = Math.round(m.passRate * 100);
        var rc = pr === 0 ? "rate-zero" : pr <= 30 ? "rate-low" : "rate-high";
        var cId = m.contributionId || "";
        var providerTag = "";
        if (hasProvider) {
          var prov = m.provider || "";
          var provCls = prov === "Anthropic" ? "provider-anthropic" : prov === "OpenAI" ? "provider-openai" : prov === "Google" ? "provider-google" : "";
          providerTag = '<td><span class="provider-badge ' + provCls + '">' + esc(prov) + '</span></td>';
        }
        var methodLabel = m.method || "API";
        var methodCls = methodLabel === "Chat Interface" ? "method-chat" : "method-api";
        var hiddenCls = idx >= PAGE_SIZE ? ' class="model-row-hidden"' : '';
        // Build a one-line tooltip describing the model's exact run parameters.
        // Native title attribute: shows on hover, no extra UI clutter.
        var tipParts = [];
        tipParts.push("Method: " + methodLabel);
        if (m.config) tipParts.push("Config: " + m.config);
        tipParts.push("Trials: " + m.trials);
        if (m.source) tipParts.push("Source: " + m.source);
        var rowTitle = tipParts.join(" \u2022 ");
        // Tiny subscript ⓘ marker if config is present (so users know there's a tooltip)
        var configMarker = m.config
          ? ' <span class="config-marker" title="' + esc(rowTitle) + '">\u24D8</span>'
          : '';
        modelHtml += '<tr data-contribution="' + esc(cId) + '" data-provider="' + esc(m.provider || '') + '" data-pass-rate="' + m.passRate + '" data-model="' + esc(m.model) + '" data-interface="' + esc(methodLabel) + '" data-trials="' + m.trials + '" title="' + esc(rowTitle) + '"' + hiddenCls + '>' +
          '<td>' + esc(m.model) + configMarker + '</td>' +
          providerTag +
          '<td><span class="method-badge ' + methodCls + '">' + esc(methodLabel) + '</span></td>' +
          '<td><span class="rate ' + rc + '">' + pr + '%</span></td>' +
          '<td>' + m.trials + '</td>' +
          '<td class="pass-bar-cell"><div class="pass-bar"><div class="pass-bar-fill" style="width:' + pr + '%"></div></div></td>' +
        '</tr>';
      });

      modelHtml += '</tbody></table>';

      // Show more / show less toggle
      if (sortedModels.length > PAGE_SIZE) {
        modelHtml += '<button class="btn btn-secondary btn-sm model-show-toggle" id="model-show-toggle" style="margin-top:8px;width:100%;">' +
          'Show all ' + sortedModels.length + ' models</button>';
      }

      modelHtml += '<p style="font-size:11px;color:var(--gray-500);margin-top:4px;">\u2020 = extended thinking variant. ' +
        'Each model tested with 10 independent trials per trap.</p>' +
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
          // Auto-expand all rows when filtering by provider
          var toggle = document.getElementById("model-show-toggle");
          if (toggle) toggle.style.display = "none";
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
            } else if (key === "interface") {
              va = (a.dataset.interface || "").toLowerCase();
              vb = (b.dataset.interface || "").toLowerCase();
              return newDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            } else if (key === "passRate") {
              va = parseFloat(a.dataset.passRate) || 0;
              vb = parseFloat(b.dataset.passRate) || 0;
              return newDir === "asc" ? va - vb : vb - va;
            } else if (key === "trials") {
              va = parseInt(a.dataset.trials) || 0;
              vb = parseInt(b.dataset.trials) || 0;
              return newDir === "asc" ? va - vb : vb - va;
            }
            return 0;
          });
          // Re-append in sorted order
          rows.forEach(function (row) { tbody.appendChild(row); });
          // Re-apply pagination so the visible top-N reflects the new sort,
          // not the original render order. Otherwise sorting "Pass Rate desc"
          // would still show the original first-10 rows even after reordering.
          var toggle = document.getElementById("model-show-toggle");
          var expanded = toggle && /fewer/i.test(toggle.textContent);
          var PAGE_SIZE = 10;
          rows.forEach(function (row, idx) {
            if (expanded) {
              row.classList.remove("model-row-hidden");
              row.style.display = "";
            } else if (idx >= PAGE_SIZE) {
              row.classList.add("model-row-hidden");
              row.style.display = "none";
            } else {
              row.classList.remove("model-row-hidden");
              row.style.display = "";
            }
          });
          if (toggle && !expanded) {
            toggle.textContent = "Show all " + rows.length + " models";
          }
        });
      });
    }

    // Wire up show more/less toggle for model table
    var showToggle = document.getElementById("model-show-toggle");
    if (showToggle) {
      var expanded = false;
      showToggle.addEventListener("click", function () {
        expanded = !expanded;
        var mt = document.getElementById("model-table");
        if (mt) {
          mt.querySelectorAll("tbody tr.model-row-hidden").forEach(function (row) {
            row.style.display = expanded ? "" : "none";
          });
        }
        showToggle.textContent = expanded ? "Show fewer models" : "Show all " + t.modelTests.length + " models";
      });
      // Initially hide overflow rows
      var mt2 = document.getElementById("model-table");
      if (mt2) {
        mt2.querySelectorAll("tbody tr.model-row-hidden").forEach(function (row) {
          row.style.display = "none";
        });
      }
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

  // ====================================================================
  //   MODEL-CENTRIC VIEW (browse by model instead of by trap)
  // ====================================================================

  var activeModelFilter = "all";          // provider OR thinking/no-thinking
  var activeModelSort = "avgDesc";
  var modelSearchQuery = "";
  var activeSubView = "cards";            // 'cards' | 'list' | 'matrix'
  var activeGroupBy = "none";             // 'none' | 'provider' | 'family' | 'thinking'

  // Aggregate: walk allTraps and produce one row per (model, contributionId) pair
  function aggregateModels() {
    var byKey = {};   // key -> {model, provider, config, contributionId, perTrap[], totalTrials, passes, totalCalls}
    allTraps.forEach(function (t) {
      if (!t.modelTests) return;
      // Only count traps with agentTests data (ie main 6, not Shape Overload)
      // — keep all traps in counts but per-trap heatmap should reflect 6 base traps too
      t.modelTests.forEach(function (m) {
        var key = m.model + "|" + (m.contributionId || "");
        if (!byKey[key]) {
          byKey[key] = {
            model: m.model,
            provider: m.provider || "",
            method: m.method || "API",
            config: m.config || "",
            source: m.source || "",
            contributionId: m.contributionId || "",
            perTrap: {},          // trap.id -> {passRate, trials, trapName}
          };
        }
        byKey[key].perTrap[t.id] = {
          passRate: m.passRate,
          trials: m.trials,
          trapName: t.name,
        };
      });
    });
    // Build a category lookup from the trap data itself (so categories are NOT hardcoded —
    // adding new traps with new categories Just Works).
    var trapCategoryById = {};
    allTraps.forEach(function (t) {
      trapCategoryById[t.id] = t.category || "Uncategorized";
    });

    // Compute aggregates
    var rows = Object.keys(byKey).map(function (k) {
      var r = byKey[k];
      var trapIds = Object.keys(r.perTrap);
      var passSum = 0;
      var trialSum = 0;
      trapIds.forEach(function (id) {
        passSum += r.perTrap[id].passRate;
        trialSum += r.perTrap[id].trials;
      });
      r.avgPass = trapIds.length > 0 ? passSum / trapIds.length : 0;
      r.totalTrials = trialSum;
      r.trapCount = trapIds.length;
      r.passedCount = trapIds.filter(function (id) { return r.perTrap[id].passRate >= 0.8; }).length;
      r.failedCount = trapIds.filter(function (id) { return r.perTrap[id].passRate <= 0.2; }).length;
      r.mixedCount = r.trapCount - r.passedCount - r.failedCount;

      // Thinking flag: read directly from the data (set by audit_thinking_flag.py).
      // Every modelTests entry has an explicit isThinking: true|false written by
      // the audit script after manual classification of every model variant.
      // We aggregate across all entries for this (model, contributionId) — they
      // should all agree, but if any are true the model is classified as thinking.
      // Fallback (legacy entries without the field): use the canonical † signal.
      var anyExplicit = false;
      var anyTrue = false;
      var anyFalse = false;
      allTraps.forEach(function (t) {
        if (!t.modelTests) return;
        t.modelTests.forEach(function (m) {
          var k = m.model + "|" + (m.contributionId || "");
          if (k !== r.model + "|" + r.contributionId) return;
          if (typeof m.isThinking === "boolean") {
            anyExplicit = true;
            if (m.isThinking) anyTrue = true; else anyFalse = true;
          }
        });
      });
      if (anyExplicit) {
        r.isThinking = anyTrue && !anyFalse ? true : (anyFalse && !anyTrue ? false : anyTrue);
      } else {
        r.isThinking = r.model.indexOf("\u2020") !== -1;
      }

      // Per-category aggregation (works for any number of categories / traps)
      var byCat = {};
      trapIds.forEach(function (id) {
        var cat = trapCategoryById[id] || "Uncategorized";
        if (!byCat[cat]) byCat[cat] = { sum: 0, n: 0, traps: [] };
        byCat[cat].sum += r.perTrap[id].passRate;
        byCat[cat].n += 1;
        byCat[cat].traps.push({ id: id, name: r.perTrap[id].trapName, passRate: r.perTrap[id].passRate });
      });
      r.byCategory = Object.keys(byCat).sort().map(function (cat) {
        return { category: cat, avgPass: byCat[cat].sum / byCat[cat].n, n: byCat[cat].n, traps: byCat[cat].traps };
      });

      return r;
    });
    return rows;
  }

  // ---- Filter + sort applied to the aggregated rows ----
  function applyModelFilters(rows) {
    var filtered = rows.filter(function (r) {
      if (activeModelFilter === "Anthropic" && r.provider !== "Anthropic") return false;
      if (activeModelFilter === "OpenAI" && r.provider !== "OpenAI") return false;
      if (activeModelFilter === "Google" && r.provider !== "Google") return false;
      if (activeModelFilter === "thinking" && !r.isThinking) return false;
      if (activeModelFilter === "no-thinking" && r.isThinking) return false;
      if (modelSearchQuery) {
        var hay = (r.model + " " + r.provider + " " + r.config).toLowerCase();
        if (hay.indexOf(modelSearchQuery) === -1) return false;
      }
      return true;
    });
    filtered.sort(function (a, b) {
      switch (activeModelSort) {
        case "avgAsc":   return a.avgPass - b.avgPass;
        case "avgDesc":  return b.avgPass - a.avgPass;
        case "name":     return a.model.localeCompare(b.model);
        case "provider": return (a.provider + a.model).localeCompare(b.provider + b.model);
      }
      return 0;
    });
    return filtered;
  }

  // ---- Provider CSS-class lookup ----
  function providerClass(p) {
    return p === "Anthropic" ? "provider-anthropic"
      : p === "OpenAI" ? "provider-openai"
      : p === "Google" ? "provider-google" : "";
  }

  // ---- Pass-rate semantic class ----
  function passClass(rate) {
    if (rate >= 0.8) return "rate-high";
    if (rate >= 0.5) return "rate-mid";
    if (rate > 0)    return "rate-low";
    return "rate-zero";
  }

  // ---- Render top stats banner (shared by all sub-views) ----
  function summaryBannerHtml(allRows) {
    if (allRows.length === 0) return "";
    var perfectCount = allRows.filter(function (r) {
      return r.trapCount > 0 && r.byCategory.every(function (c) { return c.avgPass === 1.0; });
    }).length;
    var zeroCount = allRows.filter(function (r) {
      return r.trapCount > 0 && r.byCategory.every(function (c) { return c.avgPass === 0; });
    }).length;
    var providerCounts = {};
    allRows.forEach(function (r) {
      var p = r.provider || "Unknown";
      providerCounts[p] = (providerCounts[p] || 0) + 1;
    });
    var providerSummary = Object.keys(providerCounts).sort().map(function (p) {
      return p + ": " + providerCounts[p];
    }).join("  ·  ");

    return '<div class="model-summary-banner">' +
      '<div class="msb-stat"><div class="msb-num">' + allRows.length + '</div><div class="msb-lbl">Model variants</div></div>' +
      '<div class="msb-stat"><div class="msb-num msb-good">' + perfectCount + '</div><div class="msb-lbl">Pass every trap</div></div>' +
      '<div class="msb-stat"><div class="msb-num msb-bad">' + zeroCount + '</div><div class="msb-lbl">Fail every trap</div></div>' +
      '<div class="msb-stat msb-wide"><div class="msb-sub">' + providerSummary + '</div><div class="msb-lbl">By provider</div></div>' +
      '</div>';
  }

  // ====================================================================
  //   SUB-VIEW 1: CARDS (default — model report cards organized by category)
  // ====================================================================
  function renderCardsView(rows) {
    if (rows.length === 0) {
      return '<p class="empty-state-msg">No models match your filters.</p>';
    }
    var cardsHtml = rows.map(function (r) {
      var avgPct = Math.round(r.avgPass * 100);
      var avgCls = passClass(r.avgPass);
      var thinkBadge = r.isThinking
        ? '<span class="thinking-badge" title="Extended thinking / reasoning enabled">\u2020 thinking</span>'
        : '';

      // Stat tiles
      var statsRow =
        '<div class="mc-stats">' +
          '<div class="mc-stat-tile"><div class="mc-stat-num ' + avgCls + '">' + avgPct + '%</div><div class="mc-stat-lbl">avg pass</div></div>' +
          '<div class="mc-stat-tile"><div class="mc-stat-num">' + r.passedCount + '/' + r.trapCount + '</div><div class="mc-stat-lbl">traps passed (≥80%)</div></div>' +
          '<div class="mc-stat-tile"><div class="mc-stat-num">' + r.failedCount + '/' + r.trapCount + '</div><div class="mc-stat-lbl">traps failed (≤20%)</div></div>' +
          '<div class="mc-stat-tile"><div class="mc-stat-num">' + r.totalTrials + '</div><div class="mc-stat-lbl">trials</div></div>' +
        '</div>';

      // Avg-pass progress bar (full width)
      var avgBar =
        '<div class="mc-avg-bar"><div class="mc-avg-bar-fill ' + avgCls + '" style="width:' + avgPct + '%"></div></div>';

      // Per-category coverage rows (scales with N categories)
      var catRows = r.byCategory.map(function (c) {
        var pct = Math.round(c.avgPass * 100);
        var cls = passClass(c.avgPass);
        return '<div class="mc-cat-row">' +
          '<div class="mc-cat-name">' + esc(c.category) + ' <span class="mc-cat-n">(' + c.n + ' trap' + (c.n !== 1 ? 's' : '') + ')</span></div>' +
          '<div class="mc-cat-bar"><div class="mc-cat-bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
          '<div class="mc-cat-pct ' + cls + '">' + pct + '%</div>' +
          '</div>';
      }).join("");

      return '<article class="model-card" data-key="' + esc(r.model + "|" + r.contributionId) + '" tabindex="0">' +
        '<header class="mc-header">' +
          '<div class="mc-header-top">' +
            '<span class="provider-badge ' + providerClass(r.provider) + '">' + esc(r.provider) + '</span>' +
            thinkBadge +
          '</div>' +
          '<h3 class="mc-title">' + esc(r.model) + '</h3>' +
          '<div class="mc-subtitle"><code>' + esc(r.config || "—") + '</code></div>' +
        '</header>' +
        statsRow +
        avgBar +
        '<div class="mc-cat-section">' +
          '<div class="mc-cat-section-title">Constraint coverage</div>' +
          catRows +
        '</div>' +
        '<div class="mc-footer">Click for full per-trap breakdown →</div>' +
      '</article>';
    }).join("");

    return '<div class="model-cards-grid">' + cardsHtml + '</div>';
  }

  // ====================================================================
  //   SUB-VIEW 2: LIST (compact table)
  // ====================================================================
  function renderListView(rows) {
    if (rows.length === 0) return '<p class="empty-state-msg">No models match your filters.</p>';
    var html = '<div class="model-list-wrapper"><table class="model-list-table">' +
      '<thead><tr>' +
        '<th class="lt-rank">#</th>' +
        '<th>Model</th>' +
        '<th>Provider</th>' +
        '<th class="lt-config">Configuration</th>' +
        '<th class="lt-num">Avg pass</th>' +
        '<th class="lt-num">Passes</th>' +
        '<th class="lt-num">Fails</th>' +
        '<th class="lt-num">Trials</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r, i) {
      var avgPct = Math.round(r.avgPass * 100);
      var avgCls = passClass(r.avgPass);
      html += '<tr class="model-list-row" data-key="' + esc(r.model + "|" + r.contributionId) + '">' +
        '<td class="lt-rank">' + (i + 1) + '</td>' +
        '<td class="lt-model"><strong>' + esc(r.model) + '</strong></td>' +
        '<td><span class="provider-badge ' + providerClass(r.provider) + '">' + esc(r.provider) + '</span></td>' +
        '<td class="lt-config"><code>' + esc(r.config || "—") + '</code></td>' +
        '<td class="lt-num"><span class="rate-badge ' + avgCls + '">' + avgPct + '%</span></td>' +
        '<td class="lt-num">' + r.passedCount + '/' + r.trapCount + '</td>' +
        '<td class="lt-num">' + r.failedCount + '/' + r.trapCount + '</td>' +
        '<td class="lt-num lt-muted">' + r.totalTrials + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // ====================================================================
  //   SUB-VIEW 3: MATRIX (models × traps grid; horizontally scrollable;
  //   stays usable for any N traps because container scrolls naturally)
  // ====================================================================
  function renderMatrixView(rows) {
    if (rows.length === 0) return '<p class="empty-state-msg">No models match your filters.</p>';
    var trapList = allTraps.filter(function (t) { return t.modelTests && t.modelTests.length > 0; });

    var headerCols = trapList.map(function (t) {
      return '<th class="mt-trap-col" title="' + esc(t.name) + ' — ' + esc(t.category) + '">' +
        '<div class="mt-trap-name">' + esc(t.name) + '</div>' +
        '<div class="mt-trap-cat">' + esc(t.category) + '</div>' +
        '</th>';
    }).join("");

    var bodyRows = rows.map(function (r, i) {
      var cells = trapList.map(function (t) {
        var pt = r.perTrap[t.id];
        if (!pt) return '<td class="mt-na" title="No data">—</td>';
        var pct = Math.round(pt.passRate * 100);
        var cls = passClass(pt.passRate);
        var passed = Math.round(pt.passRate * pt.trials);
        var tip = t.name + " — " + pct + "% (" + passed + "/" + pt.trials + ")";
        return '<td class="mt-cell ' + cls + '" title="' + esc(tip) + '">' + pct + '</td>';
      }).join("");
      var avgPct = Math.round(r.avgPass * 100);
      var avgCls = passClass(r.avgPass);
      return '<tr class="model-list-row" data-key="' + esc(r.model + "|" + r.contributionId) + '">' +
        '<td class="mt-rank">' + (i + 1) + '</td>' +
        '<td class="mt-model"><strong>' + esc(r.model) + '</strong>' +
          '<div class="mt-model-sub"><span class="provider-badge ' + providerClass(r.provider) + '">' + esc(r.provider) + '</span></div></td>' +
        cells +
        '<td class="mt-avg ' + avgCls + '">' + avgPct + '%</td>' +
      '</tr>';
    }).join("");

    return '<div class="model-matrix-wrapper"><div class="mt-scroll-hint">↔ scroll horizontally for more traps</div>' +
      '<table class="model-matrix-table">' +
        '<thead><tr>' +
          '<th class="mt-rank">#</th>' +
          '<th class="mt-model">Model</th>' +
          headerCols +
          '<th class="mt-avg">Avg</th>' +
        '</tr></thead>' +
        '<tbody>' + bodyRows + '</tbody>' +
      '</table></div>';
  }

  // ====================================================================
  //   GROUPING (None / Provider / Family / Thinking on-off)
  // ====================================================================
  function modelFamily(name, provider) {
    // Best-effort family extraction from display name. Stable across providers.
    if (provider === "Anthropic") {
      var m = name.match(/Claude\s+(Haiku|Sonnet|Opus)\s+(\d+\.\d+)/);
      if (m) return "Claude " + m[1] + " " + m[2];
    }
    if (provider === "OpenAI") {
      var g = name.match(/GPT-(\d+\.\d+)/);
      if (g) return "GPT-" + g[1];
    }
    if (provider === "Google") {
      var ge = name.match(/Gemini\s+(\d+\.\d+|\d+)/);
      if (ge) {
        var sub = name.match(/Flash(?:\s+Lite)?|Pro/);
        return "Gemini " + ge[1] + (sub ? " " + sub[0] : "");
      }
    }
    return name.replace(/\u2020.*$/, "").trim();
  }

  function groupRows(rows) {
    if (activeGroupBy === "none") {
      return [{ label: null, rows: rows }];
    }
    var groups = {};
    rows.forEach(function (r) {
      var key;
      if (activeGroupBy === "provider") {
        key = r.provider || "Other";
      } else if (activeGroupBy === "family") {
        key = modelFamily(r.model, r.provider);
      } else if (activeGroupBy === "thinking") {
        key = r.isThinking ? "With thinking / reasoning" : "No thinking / reasoning";
      } else {
        key = "All";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    // Order groups intelligently: by total count desc, then alphabetical
    var sorted = Object.keys(groups).sort(function (a, b) {
      var diff = groups[b].length - groups[a].length;
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
    return sorted.map(function (k) { return { label: k, rows: groups[k] }; });
  }

  function groupHeaderHtml(group) {
    if (group.label === null) return "";
    // Compute per-group avg pass and provider mix
    var sum = 0;
    var providerSet = {};
    var thinkingCount = 0;
    group.rows.forEach(function (r) {
      sum += r.avgPass;
      providerSet[r.provider] = (providerSet[r.provider] || 0) + 1;
      if (r.isThinking) thinkingCount++;
    });
    var avg = group.rows.length > 0 ? sum / group.rows.length : 0;
    var avgPct = Math.round(avg * 100);
    var avgCls = passClass(avg);

    // Build a small accent for provider-grouped headers
    var accentCls = "";
    if (activeGroupBy === "provider") {
      accentCls = providerClass(group.label);
    }

    var providerLine = activeGroupBy === "provider"
      ? '<span class="mg-meta">' + group.rows.length + ' variant' + (group.rows.length !== 1 ? 's' : '') +
        '  ·  ' + thinkingCount + ' with thinking</span>'
      : '<span class="mg-meta">' + group.rows.length + ' model' + (group.rows.length !== 1 ? 's' : '') +
        '  ·  ' + Object.keys(providerSet).map(function (p) {
          return p + ' ' + providerSet[p];
        }).join(' · ') + '</span>';

    return '<div class="model-group-header ' + accentCls + '">' +
      '<div class="mg-title">' + esc(group.label) + '</div>' +
      providerLine +
      '<div class="mg-avg ' + avgCls + '">' + avgPct + '% <span class="mg-avg-lbl">avg pass</span></div>' +
    '</div>';
  }

  // ====================================================================
  //   Top-level render dispatcher
  // ====================================================================
  function renderModels() {
    var container = document.getElementById("model-leaderboard");
    var countEl = document.getElementById("model-count");
    if (!container) return;

    var allRows = aggregateModels();
    var rows = applyModelFilters(allRows);

    if (countEl) {
      countEl.textContent = rows.length + " of " + allRows.length + " model" + (allRows.length !== 1 ? "s" : "")
        + (activeModelFilter !== "all" ? " (" + activeModelFilter + ")" : "");
    }

    var bannerHtml = summaryBannerHtml(allRows);

    // Build sub-view HTML, optionally with group headers
    var groups = groupRows(rows);
    var subViewHtml = groups.map(function (g) {
      var inner;
      if (activeSubView === "cards") inner = renderCardsView(g.rows);
      else if (activeSubView === "list") inner = renderListView(g.rows);
      else inner = renderMatrixView(g.rows);
      return groupHeaderHtml(g) + inner;
    }).join("");

    container.innerHTML = bannerHtml + (subViewHtml || '<p class="empty-state-msg">No models match your filters.</p>');

    // Wire click-to-open-detail
    container.querySelectorAll("[data-key]").forEach(function (el) {
      var open = function () { openModelModal(el.dataset.key, allRows); };
      el.addEventListener("click", open);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }


  function openModelModal(key, rows) {
    var r = rows.find(function (x) { return (x.model + "|" + x.contributionId) === key; });
    if (!r) return;
    var overlay = document.getElementById("modal-overlay");
    var modal = document.getElementById("modal");
    if (!overlay || !modal) return;

    var trapOrder = allTraps.filter(function (t) { return t.modelTests && t.modelTests.length > 0; });

    var rowsHtml = trapOrder.map(function (t) {
      var pt = r.perTrap[t.id];
      if (!pt) {
        return '<tr><td>' + esc(t.name) + '</td><td colspan="3" class="muted">No trial data</td></tr>';
      }
      var pct = Math.round(pt.passRate * 100);
      var cls = pct === 0 ? "rate-zero" : pct <= 30 ? "rate-low" : pct <= 70 ? "rate-mid" : "rate-high";
      var passed = Math.round(pt.passRate * pt.trials);
      return '<tr>' +
        '<td><a href="#" data-jump-trap="' + esc(t.id) + '">' + esc(t.name) + '</a></td>' +
        '<td><span class="rate ' + cls + '">' + pct + '%</span></td>' +
        '<td>' + passed + ' / ' + pt.trials + '</td>' +
        '<td><div class="pass-bar"><div class="pass-bar-fill" style="width:' + pct + '%"></div></div></td>' +
      '</tr>';
    }).join("");

    var avgPct = Math.round(r.avgPass * 100);
    var provCls = r.provider === "Anthropic" ? "provider-anthropic"
      : r.provider === "OpenAI" ? "provider-openai"
      : r.provider === "Google" ? "provider-google" : "";

    modal.innerHTML =
      '<button class="modal-close" id="modal-close">\u00D7</button>' +
      '<div class="modal-header">' +
        '<div class="modal-title-block">' +
          '<h2>' + esc(r.model) + '</h2>' +
          '<div class="modal-meta-row">' +
            '<span class="provider-badge ' + provCls + '">' + esc(r.provider) + '</span>' +
            '<span class="modal-meta-text">Method: <strong>' + esc(r.method) + '</strong></span>' +
            '<span class="modal-meta-text">Config: <strong>' + esc(r.config || "n/a") + '</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="modal-stats" style="margin-top:12px;">' +
          mStat(avgPct + "%", "Avg pass", r.trapCount + " traps", avgPct >= 80 ? "good" : avgPct >= 30 ? "warn" : "neutral") +
          mStat(r.totalTrials, "Total trials", r.source, "neutral") +
        '</div>' +
      '</div>' +
      '<div class="modal-section">' +
        '<div class="modal-section-title">Per-trap pass rate</div>' +
        '<table class="model-table">' +
          '<thead><tr><th>Trap</th><th>Pass</th><th>Correct/Trials</th><th></th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';

    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", escKey);

    var close = document.getElementById("modal-close");
    if (close) close.addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    // Click trap link → switch to trap view + open that trap's modal
    modal.querySelectorAll("a[data-jump-trap]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var trap = allTraps.find(function (x) { return x.id === a.dataset.jumpTrap; });
        if (trap) { closeModal(); setTimeout(function () { setActiveView("traps"); openModal(trap); }, 50); }
      });
    });
  }

  // ---- View toggle wiring ----
  function setActiveView(v) {
    var traps = document.getElementById("trap-view");
    var models = document.getElementById("model-view");
    if (!traps || !models) return;
    traps.style.display = (v === "traps") ? "" : "none";
    models.style.display = (v === "models") ? "" : "none";
    document.querySelectorAll(".view-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === v);
    });
    if (v === "models") renderModels();
  }

  function initViewToggle() {
    document.querySelectorAll(".view-btn").forEach(function (b) {
      b.addEventListener("click", function () { setActiveView(b.dataset.view); });
    });
    // Model search
    var msearch = document.getElementById("model-search");
    if (msearch) {
      var t;
      msearch.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () {
          modelSearchQuery = msearch.value.trim().toLowerCase();
          renderModels();
        }, 200);
      });
    }
    // Model filters
    document.querySelectorAll("[data-mfilter]").forEach(function (b) {
      b.addEventListener("click", function () {
        activeModelFilter = b.dataset.mfilter;
        document.querySelectorAll("[data-mfilter]").forEach(function (x) {
          x.classList.toggle("active", x.dataset.mfilter === activeModelFilter);
        });
        renderModels();
      });
    });
    // Model sort
    document.querySelectorAll("[data-msort]").forEach(function (b) {
      b.addEventListener("click", function () {
        activeModelSort = b.dataset.msort;
        document.querySelectorAll("[data-msort]").forEach(function (x) {
          x.classList.toggle("active", x.dataset.msort === activeModelSort);
        });
        renderModels();
      });
    });
    // Sub-view: cards / list / matrix
    document.querySelectorAll("[data-subview]").forEach(function (b) {
      b.addEventListener("click", function () {
        activeSubView = b.dataset.subview;
        document.querySelectorAll("[data-subview]").forEach(function (x) {
          x.classList.toggle("active", x.dataset.subview === activeSubView);
        });
        renderModels();
      });
    });
    // Group-by: none / provider / family / thinking
    document.querySelectorAll("[data-group]").forEach(function (b) {
      b.addEventListener("click", function () {
        activeGroupBy = b.dataset.group;
        document.querySelectorAll("[data-group]").forEach(function (x) {
          x.classList.toggle("active", x.dataset.group === activeGroupBy);
        });
        renderModels();
      });
    });
  }

  // Wire up once DOM is ready (may already be)
  initViewToggle();

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
