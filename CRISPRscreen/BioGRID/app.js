const DATA = window.E3_ORCS_DATA;
const genes = DATA.genes.map((gene) => ({
  ...gene,
  tested_screens: Number(gene.tested_screens),
  hit_screens: Number(gene.hit_screens),
  hit_rate: Number(gene.hit_rate),
  global_importance_score: Number(gene.global_importance_score),
  phenotype_specificity_score: Number(gene.phenotype_specificity_score),
  non_proliferation_hit_screens: Number(gene.non_proliferation_hit_screens),
  non_proliferation_hit_rate: Number(gene.non_proliferation_hit_rate),
  dominant_phenotype_hit_fraction: Number(gene.dominant_phenotype_hit_fraction),
  global_importance_rank: Number(gene.global_importance_rank),
  phenotype_specificity_rank: Number(gene.phenotype_specificity_rank),
}));

const typeColors = {
  RING: "#226b80",
  CRL1: "#c95c41",
  CRL2: "#3f7f58",
  CRL3: "#bb8a1e",
  CRL4: "#6b4c7a",
  CRL5: "#16817a",
  HECT: "#8a4f3d",
  "Degenerate RING": "#5c6f9f",
  RBR: "#9a5b85",
  "APC/C": "#b6792d",
  Atypical: "#65726b",
};

const state = {
  search: "",
  type: "all",
  phenotype: "all",
  minHits: 0,
  sortBy: "global",
  selectedGene: null,
};

const els = {
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  phenotypeFilter: document.querySelector("#phenotypeFilter"),
  minHits: document.querySelector("#minHits"),
  sortBy: document.querySelector("#sortBy"),
  visibleCount: document.querySelector("#visibleCount"),
  medianGlobal: document.querySelector("#medianGlobal"),
  medianSpecific: document.querySelector("#medianSpecific"),
  nonProlifTotal: document.querySelector("#nonProlifTotal"),
  huwe1Example: document.querySelector("#huwe1Example"),
  typeBars: document.querySelector("#typeBars"),
  phenotypeStrips: document.querySelector("#phenotypeStrips"),
  quadrants: document.querySelector("#quadrants"),
  geneCards: document.querySelector("#geneCards"),
  scatterCanvas: document.querySelector("#scatterCanvas"),
  resetZoom: document.querySelector("#resetZoom"),
  detailPanel: document.querySelector("#detailPanel"),
  detailContent: document.querySelector("#detailContent"),
  closeDetail: document.querySelector("#closeDetail"),
  summaryGenes: document.querySelector("#summaryGenes"),
  summaryHits: document.querySelector("#summaryHits"),
};

els.summaryGenes.textContent = DATA.summary.curated_e3s.toLocaleString();
els.summaryHits.textContent = DATA.summary.e3s_with_hits.toLocaleString();

function uniqueValues(key) {
  return [...new Set(genes.map((gene) => gene[key]).filter(Boolean))].sort();
}

function fillSelect(select, values, allLabel) {
  select.innerHTML = `<option value="all">${allLabel}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

fillSelect(els.typeFilter, uniqueValues("e3_type"), "All types");
fillSelect(els.phenotypeFilter, uniqueValues("dominant_phenotype"), "All phenotypes");

function includesText(gene, text) {
  if (!text) return true;
  const haystack = [
    gene.gene,
    gene.gene_id,
    gene.uniprot,
    gene.e3_type,
    gene.protein_class,
    gene.dominant_phenotype,
    gene.top_phenotypes,
    gene.top_non_proliferation_phenotypes,
    gene.top_cell_lines,
    gene.top_conditions,
    gene.top_screen_rationales,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(text.toLowerCase());
}

function filteredGenes() {
  const list = genes.filter((gene) => {
    if (!includesText(gene, state.search)) return false;
    if (state.type !== "all" && gene.e3_type !== state.type) return false;
    if (state.phenotype !== "all" && gene.dominant_phenotype !== state.phenotype) return false;
    if (gene.hit_screens < state.minHits) return false;
    return true;
  });

  const sorters = {
    global: (a, b) => b.global_importance_score - a.global_importance_score || b.hit_screens - a.hit_screens,
    specificity: (a, b) => b.phenotype_specificity_score - a.phenotype_specificity_score || b.hit_screens - a.hit_screens,
    non_prolif: (a, b) => b.non_proliferation_hit_screens - a.non_proliferation_hit_screens || b.global_importance_score - a.global_importance_score,
    hits: (a, b) => b.hit_screens - a.hit_screens || b.tested_screens - a.tested_screens,
    gene: (a, b) => a.gene.localeCompare(b.gene),
  };
  return list.sort(sorters[state.sortBy]);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function aggregate(list, key) {
  const map = new Map();
  list.forEach((gene) => {
    const name = gene[key] || "Unannotated";
    if (!map.has(name)) {
      map.set(name, { name, count: 0, global: 0, specific: 0, nonProlif: 0 });
    }
    const item = map.get(name);
    item.count += 1;
    item.global += gene.global_importance_score;
    item.specific += gene.phenotype_specificity_score;
    item.nonProlif += gene.non_proliferation_hit_screens;
  });
  return [...map.values()]
    .map((item) => ({
      ...item,
      avgGlobal: item.global / item.count,
      avgSpecific: item.specific / item.count,
    }))
    .sort((a, b) => b.count - a.count);
}

function renderStats(list) {
  els.visibleCount.textContent = list.length.toLocaleString();
  els.medianGlobal.textContent = median(list.map((gene) => gene.global_importance_score)).toFixed(1);
  els.medianSpecific.textContent = median(list.map((gene) => gene.phenotype_specificity_score)).toFixed(1);
  els.nonProlifTotal.textContent = list
    .reduce((sum, gene) => sum + gene.non_proliferation_hit_screens, 0)
    .toLocaleString();
}

function renderTypeBars(list) {
  const rows = aggregate(list, "e3_type").slice(0, 12);
  const max = Math.max(...rows.map((row) => row.avgGlobal), 1);
  els.typeBars.innerHTML = rows
    .map((row) => {
      const width = (row.avgGlobal / max) * 100;
      const color = typeColors[row.name] || "#226b80";
      return `
        <div class="bar-row">
          <div class="bar-label" title="${row.name}">${row.name}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${color}"></div></div>
          <div class="bar-count">${row.count}</div>
        </div>
      `;
    })
    .join("");
}

function renderPhenotypes(list) {
  const rows = aggregate(list, "dominant_phenotype").filter((row) => row.name !== "Unannotated");
  const max = Math.max(...rows.map((row) => row.count), 1);
  els.phenotypeStrips.innerHTML = rows
    .map((row) => `
      <div class="phenotype-pill">
        <strong>${row.name}</strong>
        <div class="strip"><span style="width:${(row.count / max) * 100}%"></span></div>
        <em>${row.count}</em>
      </div>
    `)
    .join("");
}

function renderQuadrants(list) {
  const bins = [
    {
      label: "Broad hitters",
      detail: "global >= 30, specificity < 70",
      count: list.filter((gene) => gene.global_importance_score >= 30 && gene.phenotype_specificity_score < 70).length,
    },
    {
      label: "Focused strong",
      detail: "global >= 30, specificity >= 70",
      count: list.filter((gene) => gene.global_importance_score >= 30 && gene.phenotype_specificity_score >= 70).length,
    },
    {
      label: "Quiet or rare",
      detail: "global < 5",
      count: list.filter((gene) => gene.global_importance_score < 5).length,
    },
    {
      label: "Context hints",
      detail: "non-proliferation hits >= 10",
      count: list.filter((gene) => gene.non_proliferation_hit_screens >= 10).length,
    },
  ];
  els.quadrants.innerHTML = bins
    .map((bin) => `<div class="quadrant"><strong>${bin.count}</strong><span>${bin.label}<br>${bin.detail}</span></div>`)
    .join("");
}

function renderCards(list) {
  els.geneCards.innerHTML = list
    .slice(0, 96)
    .map((gene) => {
      const color = typeColors[gene.e3_type] || "#226b80";
      const phenotype = gene.dominant_phenotype || "No BioGRID hit phenotype";
      return `
        <button class="gene-card" style="--type-color:${color}" data-gene="${gene.gene}">
          <div class="card-top">
            <div>
              <h3 class="gene-name">${gene.gene}</h3>
              <p class="class-line">${gene.e3_type} | ${gene.protein_class}</p>
            </div>
            <span class="rank-chip">#${gene.global_importance_rank}</span>
          </div>
          <div class="score-pair">
            <div class="score-box"><b>${gene.global_importance_score.toFixed(1)}</b><span>global importance</span></div>
            <div class="score-box"><b>${gene.phenotype_specificity_score.toFixed(1)}</b><span>phenotype focus</span></div>
          </div>
          <p class="phenotype-line"><strong>${phenotype}</strong><br>${gene.hit_screens}/${gene.tested_screens} hit/tested screens</p>
        </button>
      `;
    })
    .join("");
}

function drawScatter(list) {
  const canvas = els.scatterCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(720, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(Math.max(360, rect.width * 0.48) * dpr);
  ctx.scale(dpr, dpr);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const pad = { left: 54, right: 18, top: 18, bottom: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#ded4bf";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const x = pad.left + (plotW * i) / 5;
    const y = pad.top + (plotH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#65726b";
  ctx.font = "12px system-ui";
  ctx.fillText("Global importance", pad.left + plotW / 2 - 48, height - 12);
  ctx.save();
  ctx.translate(16, pad.top + plotH / 2 + 58);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Phenotype specificity", 0, 0);
  ctx.restore();

  ctx.fillStyle = "#65726b";
  ctx.font = "11px system-ui";
  for (let i = 0; i <= 5; i += 1) {
    const xValue = Math.round((70 * i) / 5);
    const yValue = Math.round((100 * i) / 5);
    const x = pad.left + (plotW * i) / 5;
    const y = pad.top + plotH - (plotH * i) / 5;
    ctx.fillText(String(xValue), x - 7, pad.top + plotH + 20);
    ctx.fillText(String(yValue), pad.left - 28, y + 4);
  }

  const selected = state.selectedGene;
  list.forEach((gene) => {
    const x = pad.left + (gene.global_importance_score / 70) * plotW;
    const y = pad.top + plotH - (gene.phenotype_specificity_score / 100) * plotH;
    const radius = Math.max(3, Math.min(12, Math.sqrt(gene.hit_screens) / 2.3));
    ctx.globalAlpha = selected && selected !== gene.gene ? 0.28 : 0.82;
    ctx.fillStyle = typeColors[gene.e3_type] || "#226b80";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (selected === gene.gene) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#18201d";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#18201d";
      ctx.font = "700 13px system-ui";
      ctx.fillText(gene.gene, x + 10, y - 10);
    }
  });
  ctx.globalAlpha = 1;

  canvas.__points = list.map((gene) => ({
    gene,
    x: pad.left + (gene.global_importance_score / 70) * plotW,
    y: pad.top + plotH - (gene.phenotype_specificity_score / 100) * plotH,
  }));
}

function interpretGene(gene) {
  const hitPct = (gene.hit_rate * 100).toFixed(1);
  const nonProlifPct = (gene.non_proliferation_hit_rate * 100).toFixed(1);
  const dominant = gene.dominant_phenotype || "no dominant hit phenotype";
  const dominantPct = (gene.dominant_phenotype_hit_fraction * 100).toFixed(1);
  return `${gene.gene} was tested in ${gene.tested_screens.toLocaleString()} ORCS screens and called a hit in ${gene.hit_screens.toLocaleString()} (${hitPct}%). Its global importance score is therefore ${gene.global_importance_score.toFixed(2)}. The phenotype specificity score of ${gene.phenotype_specificity_score.toFixed(2)} means its hits are fairly concentrated, mainly ${dominant} (${dominantPct}% of hit screens). ${gene.non_proliferation_hit_screens.toLocaleString()} hits (${nonProlifPct}% of tested screens) were outside cell proliferation.`;
}

function openDetail(gene) {
  state.selectedGene = gene.gene;
  const color = typeColors[gene.e3_type] || "#226b80";
  els.detailContent.innerHTML = `
    <h2 class="detail-title" style="color:${color}">${gene.gene}</h2>
    <p class="class-line">${gene.e3_type} | ${gene.protein_class}</p>
    <div class="detail-grid">
      <div class="detail-metric"><b>${gene.global_importance_score.toFixed(2)}</b><span class="tiny">global importance</span></div>
      <div class="detail-metric"><b>${gene.phenotype_specificity_score.toFixed(2)}</b><span class="tiny">phenotype specificity</span></div>
      <div class="detail-metric"><b>${gene.hit_screens}</b><span class="tiny">hit screens</span></div>
      <div class="detail-metric"><b>${gene.tested_screens}</b><span class="tiny">tested screens</span></div>
      <div class="detail-metric"><b>${gene.non_proliferation_hit_screens}</b><span class="tiny">non-proliferation hits</span></div>
      <div class="detail-metric"><b>${(gene.dominant_phenotype_hit_fraction * 100).toFixed(1)}%</b><span class="tiny">dominant fraction</span></div>
    </div>
    <div class="detail-callout"><p>${interpretGene(gene)}</p></div>
    <div class="detail-section"><h3>Phenotypes</h3><p>${gene.top_phenotypes || "No BioGRID hit phenotypes."}</p></div>
    <div class="detail-section"><h3>Non-proliferation phenotypes</h3><p>${gene.top_non_proliferation_phenotypes || "No non-proliferation hits."}</p></div>
    <div class="detail-section"><h3>Screen types</h3><p>${gene.top_screen_types || "Not tested."}</p></div>
    <div class="detail-section"><h3>Cell lines</h3><p>${gene.top_cell_lines || "No hit cell lines."}</p></div>
    <div class="detail-section"><h3>Conditions</h3><p>${gene.top_conditions || "No hit conditions."}</p></div>
    <div class="detail-section"><h3>Screen rationales</h3><p>${gene.top_screen_rationales || "No hit rationales."}</p></div>
    <div class="detail-section"><h3>Evidence file</h3><p>Filter e3_biogrid_orcs_hit_evidence.csv for gene = ${gene.gene} to inspect exact screen IDs and PMID rows.</p></div>
  `;
  els.detailPanel.classList.add("open");
  els.detailPanel.setAttribute("aria-hidden", "false");
  drawScatter(filteredGenes());
}

function closeDetail() {
  state.selectedGene = null;
  els.detailPanel.classList.remove("open");
  els.detailPanel.setAttribute("aria-hidden", "true");
  drawScatter(filteredGenes());
}

function renderGuideExample() {
  const gene = genes.find((item) => item.gene === "HUWE1");
  if (!gene || !els.huwe1Example) return;
  els.huwe1Example.innerHTML = `
    <div><b>${gene.global_importance_score.toFixed(2)}</b><span>global importance</span></div>
    <div><b>${gene.phenotype_specificity_score.toFixed(2)}</b><span>phenotype specificity</span></div>
    <div><b>${gene.hit_screens}/${gene.tested_screens}</b><span>hit/tested screens</span></div>
    <div><b>${gene.non_proliferation_hit_screens}</b><span>non-proliferation hits</span></div>
    <p>${interpretGene(gene)}</p>
  `;
}

function render() {
  const list = filteredGenes();
  renderStats(list);
  renderTypeBars(list);
  renderPhenotypes(list);
  renderQuadrants(list);
  renderCards(list);
  drawScatter(list);
}

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  render();
});
els.typeFilter.addEventListener("change", (event) => {
  state.type = event.target.value;
  render();
});
els.phenotypeFilter.addEventListener("change", (event) => {
  state.phenotype = event.target.value;
  render();
});
els.minHits.addEventListener("input", (event) => {
  state.minHits = Number(event.target.value || 0);
  render();
});
els.sortBy.addEventListener("change", (event) => {
  state.sortBy = event.target.value;
  render();
});
els.geneCards.addEventListener("click", (event) => {
  const card = event.target.closest(".gene-card");
  if (!card) return;
  const gene = genes.find((item) => item.gene === card.dataset.gene);
  if (gene) openDetail(gene);
});
els.scatterCanvas.addEventListener("click", (event) => {
  const rect = els.scatterCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = (els.scatterCanvas.__points || [])
    .map((point) => ({ ...point, distance: Math.hypot(point.x - x, point.y - y) }))
    .filter((point) => point.distance < 14)
    .sort((a, b) => a.distance - b.distance)[0];
  if (hit) openDetail(hit.gene);
});
els.closeDetail.addEventListener("click", closeDetail);
els.resetZoom.addEventListener("click", () => {
  state.search = "";
  state.type = "all";
  state.phenotype = "all";
  state.minHits = 0;
  state.sortBy = "global";
  els.searchInput.value = "";
  els.typeFilter.value = "all";
  els.phenotypeFilter.value = "all";
  els.minHits.value = "0";
  els.sortBy.value = "global";
  closeDetail();
  render();
});
window.addEventListener("resize", () => drawScatter(filteredGenes()));

renderGuideExample();
render();
