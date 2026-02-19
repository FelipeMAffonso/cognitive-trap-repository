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

    var discriminationPP = 0;
    if (t.pooledAgentResults && t.pooledAgentResults.discriminationPP != null) {
      discriminationPP = t.pooledAgentResults.discriminationPP;
    } else if (agentFailRate !== null && humanPassRate !== null) {
      discriminationPP = (agentFailRate - (1 - humanPassRate)) * 100;
    } else if (modelFailRate !== null && humanPassRate !== null) {
      discriminationPP = (modelFailRate - (1 - humanPassRate)) * 100;
    }

    return {
      humanPassRate: humanPassRate !== null ? humanPassRate : 0,
      humanN: humanN,
      agentFailRate: agentFailRate !== null ? agentFailRate : (modelFailRate !== null ? modelFailRate : 0),
      agentN: agentN,
      modelFailRate: modelFailRate,
      discriminationPP: discriminationPP,
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
        var key = h.cohortId || (h.platform + "|" + h.date + "|" + h.sampleSize);
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
      summaryHtml = '<div class="modal-section">' +
        '<div class="modal-section-title">Summary</div>' +
        '<div class="modal-stats">' +
          mStat(pct(failVal), failLabel, failSub, "good") +
          mStat(p.hasHumanData ? pct(p.humanPassRate) : "--", "Human Pass Rate", p.hasHumanData ? "N=" + p.humanN + " humans" : "No data", p.hasHumanData ? "good" : "muted") +
          mStat(p.discriminationPP.toFixed(1) + "pp", "Discrimination", p.hasAgentData && t.pooledAgentResults ? "\u03C7\u00B2=" + t.pooledAgentResults.chiSq.toFixed(1) + ", p<.001" : "", "neutral") +
        '</div></div>';
    }

    // ---- Layer 1: Human Studies ----
    var humanHtml = "";
    if (t.humanStudies && t.humanStudies.length > 0) {
      humanHtml = '<div class="modal-section" data-layer="human">' +
        '<div class="modal-section-title">Human Performance</div>' +
        '<table class="model-table"><thead><tr>' +
          '<th>Study</th><th>Pass Rate</th><th>N</th><th>Platform</th><th>Date</th>' +
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
          '<td>' + esc(h.date) + '</td>' +
          srcTag +
        '</tr>';
      });
      humanHtml += '</tbody></table></div>';
    }

    // ---- Layer 2: Base Model Tests ----
    var modelHtml = "";
    if (t.modelTests && t.modelTests.length > 0) {
      modelHtml = '<div class="modal-section" data-layer="model">' +
        '<div class="modal-section-title">Base Model Testing (API / Chat)</div>' +
        '<table class="model-table"><thead><tr>' +
          '<th>Model</th><th>Pass Rate</th><th>Trials</th><th></th><th>Date</th>' +
          (hasMultiple ? '<th>Source</th>' : '') +
        '</tr></thead><tbody>';
      t.modelTests.forEach(function (m) {
        var pr = Math.round(m.passRate * 100);
        var rc = pr === 0 ? "rate-zero" : pr <= 30 ? "rate-low" : "rate-high";
        var cId = m.contributionId || "";
        var cIndex = contributors.findIndex(function (c) { return c.id === cId; });
        var srcTag = hasMultiple ? '<td><span class="source-tag" style="background:' + getContributorColor(cIndex) + '">' + shortContrib(m.source) + '</span></td>' : '';
        modelHtml += '<tr data-contribution="' + esc(cId) + '">' +
          '<td>' + esc(m.model) + '</td>' +
          '<td><span class="rate ' + rc + '">' + pr + '%</span></td>' +
          '<td>' + m.trials + '</td>' +
          '<td class="pass-bar-cell"><div class="pass-bar"><div class="pass-bar-fill" style="width:' + pr + '%"></div></div></td>' +
          '<td style="color:var(--gray-600);font-size:12px;">' + esc(m.date) + '</td>' +
          srcTag +
        '</tr>';
      });
      modelHtml += '</tbody></table>' +
        '<p style="font-size:11px;color:var(--gray-500);margin-top:4px;">Each trial uses an independent session (incognito/temporary chat).</p>' +
        '</div>';
    }

    // ---- Layer 3: Agent Deployment ----
    var agentHtml = "";
    if (t.agentTests && t.agentTests.length > 0) {
      agentHtml = '<div class="modal-section" data-layer="agent">' +
        '<div class="modal-section-title">Autonomous Agent Deployment (Real Survey)</div>' +
        '<table class="model-table"><thead><tr>' +
          '<th>Agent Platform</th><th>N Deployed</th><th>Date</th>' +
          (hasMultiple ? '<th>Source</th>' : '') +
        '</tr></thead><tbody>';
      t.agentTests.forEach(function (a) {
        var cId = a.contributionId || "";
        var cIndex = contributors.findIndex(function (c) { return c.id === cId; });
        var srcTag = hasMultiple ? '<td><span class="source-tag" style="background:' + getContributorColor(cIndex) + '">' + shortContrib(a.source) + '</span></td>' : '';
        agentHtml += '<tr data-contribution="' + esc(cId) + '">' +
          '<td>' + esc(a.agent) + '</td>' +
          '<td>' + a.sampleSize + '</td>' +
          '<td style="color:var(--gray-600);font-size:12px;">' + esc(a.date) + '</td>' +
          srcTag +
        '</tr>';
      });
      agentHtml += '</tbody></table></div>';
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
  function mStat(val, label, sub, cls) {
    return '<div class="modal-stat"><span class="modal-stat-value ' + cls + '">' + val + '</span>' +
      '<span class="modal-stat-label">' + label + '</span>' +
      (sub ? '<span class="modal-stat-sub">' + sub + '</span>' : '') + '</div>';
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
