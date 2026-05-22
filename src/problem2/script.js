const PRICE_URL = "https://interview.switcheo.com/prices.json";

const tokenMetadata = [
  { symbol: "ETH", name: "Ethereum", balance: 2.4381, fallbackPrice: 3524.82 },
  { symbol: "USDC", name: "USD Coin", balance: 8450.32, fallbackPrice: 1 },
  { symbol: "BTC", name: "Bitcoin", balance: 0.5842, fallbackPrice: 103480.12 },
  { symbol: "SOL", name: "Solana", balance: 92.4, fallbackPrice: 164.48 },
  { symbol: "ATOM", name: "Cosmos Hub", balance: 1280.9, fallbackPrice: 8.42 },
  { symbol: "OSMO", name: "Osmosis", balance: 4096, fallbackPrice: 0.72 },
  { symbol: "USDT", name: "Tether", balance: 2100.5, fallbackPrice: 1 },
  { symbol: "DAI", name: "Dai", balance: 630.25, fallbackPrice: 1 },
  { symbol: "WBTC", name: "Wrapped Bitcoin", balance: 0.056, fallbackPrice: 103320.42 },
  { symbol: "LINK", name: "Chainlink", balance: 245.3, fallbackPrice: 18.91 },
  { symbol: "AAVE", name: "Aave", balance: 18.65, fallbackPrice: 294.2 },
  { symbol: "BNB", name: "BNB", balance: 13.2, fallbackPrice: 682.1 },
];

let tokens = tokenMetadata.map((token) => ({
  ...token,
  price: token.fallbackPrice,
  lastUpdated: null,
}));

const state = {
  from: tokens[0],
  to: tokens[1],
  amount: "",
  slippage: 0.5,
  selecting: "from",
  isSubmitting: false,
};

const els = {
  form: document.querySelector("#swap-form"),
  fromAmount: document.querySelector("#from-amount"),
  toAmount: document.querySelector("#to-amount"),
  fromTokenButton: document.querySelector("#from-token-button"),
  toTokenButton: document.querySelector("#to-token-button"),
  fromFiat: document.querySelector("#from-fiat"),
  toFiat: document.querySelector("#to-fiat"),
  fromBalance: document.querySelector("#from-balance"),
  toBalance: document.querySelector("#to-balance"),
  quoteRate: document.querySelector("#quote-rate"),
  priceImpact: document.querySelector("#price-impact"),
  networkFee: document.querySelector("#network-fee"),
  minimumReceived: document.querySelector("#minimum-received"),
  formError: document.querySelector("#form-error"),
  submitButton: document.querySelector("#submit-button"),
  switchButton: document.querySelector("#switch-button"),
  maxButton: document.querySelector("#max-button"),
  slippageOptions: document.querySelector("#slippage-options"),
  dialog: document.querySelector("#token-dialog"),
  closeDialog: document.querySelector("#close-dialog"),
  tokenSearch: document.querySelector("#token-search"),
  tokenList: document.querySelector("#token-list"),
  tickerGrid: document.querySelector("#ticker-grid"),
  priceSource: document.querySelector("#price-source"),
  toast: document.querySelector("#toast"),
};

function tokenIcon(symbol) {
  return `/tokens/${symbol}.svg`;
}

function money(value, options = {}) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options.precise ? 4 : 2,
  }).format(value || 0);
}

function tokenAmount(value) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value > 100 ? 2 : 6,
  }).format(value);
}

function getAmount() {
  return Number.parseFloat(state.amount);
}

function getQuote() {
  const amount = getAmount();
  if (!Number.isFinite(amount) || amount <= 0) {
    return { output: 0, feeUsd: 0, impact: 0, minReceived: 0, rate: state.from.price / state.to.price };
  }

  const notional = amount * state.from.price;
  const sizeImpact = Math.min(0.92, 0.0008 + notional / 2_500_000);
  const feeUsd = Math.max(0.12, notional * 0.0009);
  const output = ((notional - feeUsd) / state.to.price) * (1 - sizeImpact / 100);
  const minReceived = output * (1 - state.slippage / 100);

  return {
    output,
    feeUsd,
    impact: sizeImpact,
    minReceived,
    rate: state.from.price / state.to.price,
  };
}

function getLatestPrices(feed) {
  return feed.reduce((prices, item) => {
    const price = Number(item.price);
    if (!item.currency || !Number.isFinite(price)) return prices;

    const previous = prices.get(item.currency);
    const itemDate = Date.parse(item.date);
    const previousDate = previous ? Date.parse(previous.date) : 0;

    if (!previous || itemDate >= previousDate) {
      prices.set(item.currency, { ...item, price });
    }

    return prices;
  }, new Map());
}

function applyPrices(feed) {
  const latestPrices = getLatestPrices(feed);

  tokens = tokenMetadata
    .filter((token) => latestPrices.has(token.symbol) || token.fallbackPrice)
    .map((token) => {
      const priceInfo = latestPrices.get(token.symbol);

      return {
        ...token,
        price: priceInfo?.price ?? token.fallbackPrice,
        lastUpdated: priceInfo?.date ?? null,
      };
    });

  state.from = tokens.find((token) => token.symbol === state.from.symbol) ?? tokens[0];
  state.to = tokens.find((token) => token.symbol === state.to.symbol) ?? tokens[1];
}

async function loadPrices() {
  try {
    const response = await fetch(PRICE_URL);
    if (!response.ok) throw new Error(`Price feed returned ${response.status}`);

    const feed = await response.json();
    applyPrices(feed);
    els.priceSource.textContent = "Live prices";
  } catch (error) {
    els.priceSource.textContent = "Fallback prices";
    showToast("Live prices unavailable. Using local fallback prices.");
  } finally {
    renderTickers();
    render();
  }
}

function renderTokenButton(button, token) {
  button.innerHTML = `
    <img src="${tokenIcon(token.symbol)}" alt="" onerror="this.src='/tokens/Token.svg'">
    <span>${token.symbol}</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
  `;
}

function validate() {
  const amount = getAmount();

  if (state.isSubmitting) return { ok: false, message: "", cta: "Submitting swap..." };
  if (!state.amount) return { ok: false, message: "", cta: "Enter an amount" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid amount greater than zero.", cta: "Review amount" };
  }
  if (amount > state.from.balance) {
    return { ok: false, message: `Insufficient ${state.from.symbol} balance.`, cta: "Insufficient balance" };
  }
  if (state.from.symbol === state.to.symbol) {
    return { ok: false, message: "Choose two different assets to continue.", cta: "Select another token" };
  }

  return { ok: true, message: "", cta: "Confirm swap" };
}

function renderQuote() {
  const quote = getQuote();
  const amount = getAmount();
  const validAmount = Number.isFinite(amount) && amount > 0;
  const fromUsd = validAmount ? amount * state.from.price : 0;
  const toUsd = validAmount ? quote.output * state.to.price : 0;
  const validation = validate();

  els.toAmount.value = validAmount ? tokenAmount(quote.output) : "";
  els.fromFiat.textContent = money(fromUsd);
  els.toFiat.textContent = money(toUsd);
  els.fromBalance.textContent = `Balance ${tokenAmount(state.from.balance)} ${state.from.symbol}`;
  els.toBalance.textContent = `Balance ${tokenAmount(state.to.balance)} ${state.to.symbol}`;
  els.quoteRate.textContent = `1 ${state.from.symbol} = ${tokenAmount(quote.rate)} ${state.to.symbol}`;
  els.priceImpact.textContent = validAmount ? `${quote.impact.toFixed(2)}%` : "-";
  els.networkFee.textContent = validAmount ? money(quote.feeUsd, { precise: true }) : "-";
  els.minimumReceived.textContent = validAmount ? `${tokenAmount(quote.minReceived)} ${state.to.symbol}` : "-";
  els.formError.textContent = validation.message;
  els.submitButton.textContent = validation.cta;
  els.submitButton.disabled = !validation.ok;
  els.form.classList.toggle("is-submitting", state.isSubmitting);
  els.fromAmount.disabled = state.isSubmitting;
  els.maxButton.disabled = state.isSubmitting;
  els.fromTokenButton.disabled = state.isSubmitting;
  els.toTokenButton.disabled = state.isSubmitting;
  els.switchButton.disabled = state.isSubmitting;
  els.slippageOptions.querySelectorAll("button").forEach((button) => {
    button.disabled = state.isSubmitting;
  });
}

function renderTickers() {
  els.tickerGrid.innerHTML = tokens.slice(0, 6).map((token) => `
    <article class="ticker">
      <img src="${tokenIcon(token.symbol)}" alt="" onerror="this.src='/tokens/Token.svg'">
      <div>
        <strong>${token.symbol}</strong>
        <span>${money(token.price, { precise: token.price < 2 })}</span>
      </div>
      <em>${token.lastUpdated ? "Live" : "Local"}</em>
    </article>
  `).join("");
}

function renderTokens(filter = "") {
  const query = filter.trim().toLowerCase();
  const visibleTokens = tokens.filter((token) => {
    return token.symbol.toLowerCase().includes(query) || token.name.toLowerCase().includes(query);
  });

  els.tokenList.innerHTML = visibleTokens.map((token) => `
    <button class="token-option" type="button" data-symbol="${token.symbol}">
      <img src="${tokenIcon(token.symbol)}" alt="" onerror="this.src='/tokens/Token.svg'">
      <span>
        <strong>${token.symbol}</strong>
        <small>${token.name}</small>
      </span>
      <em>${tokenAmount(token.balance)}</em>
    </button>
  `).join("");
}

function render() {
  renderTokenButton(els.fromTokenButton, state.from);
  renderTokenButton(els.toTokenButton, state.to);
  renderQuote();
}

function openTokenDialog(side) {
  state.selecting = side;
  els.tokenSearch.value = "";
  renderTokens();
  els.dialog.showModal();
  els.tokenSearch.focus();
}

function selectToken(symbol) {
  const token = tokens.find((item) => item.symbol === symbol);
  if (!token) return;

  if (state.selecting === "from") {
    state.from = token;
  } else {
    state.to = token;
  }

  els.dialog.close();
  render();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.setTimeout(() => els.toast.classList.remove("visible"), 3200);
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

els.fromAmount.addEventListener("input", (event) => {
  const cleaned = event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  state.amount = cleaned;
  event.target.value = cleaned;
  renderQuote();
});

els.fromTokenButton.addEventListener("click", () => openTokenDialog("from"));
els.toTokenButton.addEventListener("click", () => openTokenDialog("to"));
els.closeDialog.addEventListener("click", () => els.dialog.close());
els.tokenSearch.addEventListener("input", (event) => renderTokens(event.target.value));
els.tokenList.addEventListener("click", (event) => {
  const option = event.target.closest("[data-symbol]");
  if (option) selectToken(option.dataset.symbol);
});

els.switchButton.addEventListener("click", () => {
  const nextFrom = state.to;
  state.to = state.from;
  state.from = nextFrom;
  render();
});

els.maxButton.addEventListener("click", () => {
  state.amount = String(state.from.balance);
  els.fromAmount.value = state.amount;
  renderQuote();
});

els.slippageOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-slippage]");
  if (!button) return;

  state.slippage = Number(button.dataset.slippage);
  els.slippageOptions.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  renderQuote();
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const validation = validate();
  if (!validation.ok) {
    els.formError.textContent = validation.message || "Complete the form before confirming.";
    return;
  }

  const quote = getQuote();
  const submittedAmount = getAmount();
  const submittedFrom = state.from.symbol;
  const submittedTo = state.to.symbol;
  const submittedOutput = quote.output;

  state.isSubmitting = true;
  renderQuote();

  await wait(1400);

  state.isSubmitting = false;
  state.amount = "";
  els.fromAmount.value = "";
  renderQuote();
  showToast(`Swap complete: ${tokenAmount(submittedAmount)} ${submittedFrom} to ${tokenAmount(submittedOutput)} ${submittedTo}`);
});

renderTickers();
render();
loadPrices();
