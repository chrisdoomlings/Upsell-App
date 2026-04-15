(function () {
if (window.__upsaleBundleOffersLoaded) return;
window.__upsaleBundleOffersLoaded = true;

var root = document.getElementById('upsale-bundle-offers-root');
if (!root) return;

var shop = root.dataset.shop || '';
var currency = root.dataset.currency || 'USD';
var apiBase = (root.dataset.apiBase || '').replace(/\/$/, '');
var codeNoteTemplate = root.dataset.codeNote || 'Bundle discount applied: [code]';
if (!shop || !apiBase) return;

var offers = [];
var offerByProductId = {};
var loadPromise = null;
var syncPromise = null;
var observer = null;
var observerTimeout = 0;
var lastDiscountKey = '';

function fmt(amount) {
var value = Number(amount || 0);
try {
return new Intl.NumberFormat(document.documentElement.lang || undefined, {
style: 'currency',
currency: currency
}).format(value);
} catch (error) {
return value.toFixed(2);
}
}

function safeJson(response) {
return response.text().then(function (text) {
if (!text) return null;
try { return JSON.parse(text); } catch (error) { return null; }
});
}

function loadOffers() {
if (offers.length) return Promise.resolve(offers);
if (loadPromise) return loadPromise;

loadPromise = fetch(apiBase + '/api/public/bundle-offers?shop=' + encodeURIComponent(shop), {
method: 'GET',
mode: 'cors',
credentials: 'omit',
cache: 'no-store'
}).then(function (response) {
return safeJson(response);
}).then(function (data) {
offers = Array.isArray(data && data.offers) ? data.offers : [];
offerByProductId = {};
offers.forEach(function (offer) {
offerByProductId[String(offer.productId)] = offer;
});
return offers;
}).catch(function () {
offers = [];
offerByProductId = {};
return offers;
}).finally(function () {
loadPromise = null;
});

return loadPromise;
}

function upsertCodeNote(priceComponent, offer) {
if (!(priceComponent instanceof HTMLElement) || !offer || !offer.code) return;
var note = priceComponent.querySelector('.upsale-bundle-code-note');
if (!(note instanceof HTMLElement)) {
note = document.createElement('small');
note.className = 'upsale-bundle-code-note';
priceComponent.appendChild(note);
}
note.textContent = codeNoteTemplate.replace(/\[code\]/g, String(offer.code));
}

function upsertBundleItemsNote(priceComponent, offer) {
if (!(priceComponent instanceof HTMLElement) || !offer) return;
var items = Array.isArray(offer.items) ? offer.items : [];
if (!items.length) return;

var note = priceComponent.querySelector('.upsale-bundle-items-note');
if (!(note instanceof HTMLElement)) {
note = document.createElement('small');
note.className = 'upsale-bundle-items-note';
priceComponent.appendChild(note);
}

var preview = items.slice(0, 3).map(function (item) {
var title = String(item && item.productTitle || '').trim();
var quantity = Number(item && item.quantity || 1);
if (!title) return '';
return title + ' x' + quantity;
}).filter(Boolean);

if (!preview.length) return;

var suffix = items.length > 3 ? ' +' + (items.length - 3) + ' more' : '';
note.textContent = 'Includes: ' + preview.join(', ') + suffix;
}

function applyPriceOverride(priceComponent, offer) {
if (!(priceComponent instanceof HTMLElement) || !offer) return;

var priceContainer = priceComponent.querySelector('[ref="priceContainer"], .price-container');
if (!(priceContainer instanceof HTMLElement)) return;

var salePrice = priceContainer.querySelector('.price__sale .price');
var comparePrice = priceContainer.querySelector('.price__sale .compare-at-price');
var regularPrice = priceContainer.querySelector('.price__regular .price');

priceContainer.classList.add('price--on-sale');

if (salePrice instanceof HTMLElement) {
salePrice.textContent = fmt(offer.discountedPrice);
}
if (comparePrice instanceof HTMLElement) {
comparePrice.textContent = fmt(offer.compareAtPrice);
}
if (regularPrice instanceof HTMLElement) {
regularPrice.textContent = fmt(offer.discountedPrice);
}

upsertCodeNote(priceComponent, offer);
upsertBundleItemsNote(priceComponent, offer);
}

function normalizeHandleFromHref(href) {
var value = String(href || '');
if (!value) return '';
try {
var parsed = new URL(value, window.location.origin);
var match = parsed.pathname.match(/\/products\/([^/?#]+)/i);
return match ? decodeURIComponent(match[1]) : '';
} catch (error) {
var fallback = value.match(/\/products\/([^/?#]+)/i);
return fallback ? decodeURIComponent(fallback[1]) : '';
}
}

function findCardCandidates() {
return document.querySelectorAll('a[href*="/products/"], [data-product-id], [data-product-handle]');
}

function findOfferForNode(node) {
if (!(node instanceof HTMLElement)) return null;

var directProductId = String(node.dataset.productId || '').trim();
if (directProductId && offerByProductId[directProductId]) {
return offerByProductId[directProductId];
}

var directHandle = String(node.dataset.productHandle || '').trim();
if (directHandle) {
var normalizedDirectHandle = directHandle.toLowerCase();
for (var i = 0; i < offers.length; i++) {
var directOffer = offers[i];
if (String(directOffer.storefrontHandle || '').trim().toLowerCase() === normalizedDirectHandle) {
return directOffer;
}
}
}

if (node instanceof HTMLAnchorElement) {
var anchorHandle = normalizeHandleFromHref(node.getAttribute('href'));
if (anchorHandle) {
var normalizedAnchorHandle = anchorHandle.toLowerCase();
for (var j = 0; j < offers.length; j++) {
var anchorOffer = offers[j];
if (String(anchorOffer.storefrontHandle || '').trim().toLowerCase() === normalizedAnchorHandle) {
return anchorOffer;
}
}
}
}

return null;
}

function findCardRoot(node) {
if (!(node instanceof HTMLElement)) return null;
return node.closest('product-card, .product-card, .card-product, .product-item, .grid__item, li, .swiper-slide, .card-wrapper, .product-block');
}

function findFallbackPriceHost(cardRoot) {
if (!(cardRoot instanceof HTMLElement)) return null;
return cardRoot.querySelector(
  'product-price, .price, .price-list, .card-information .price, .card-information__wrapper .price, .product-card__price, .card-product-price, .price-item'
);
}

function applyFallbackPriceOverride(cardRoot, offer) {
if (!(cardRoot instanceof HTMLElement) || !offer) return;

var priceHost = findFallbackPriceHost(cardRoot);
if (!(priceHost instanceof HTMLElement)) return;
if (priceHost.closest('[data-upsale-bundle-rendered="true"]')) return;

priceHost.setAttribute('data-upsale-bundle-rendered', 'true');
priceHost.innerHTML =
  '<div class="upsale-bundle-sale-row">' +
    '<span class="upsale-bundle-sale-price">' + fmt(offer.discountedPrice) + '</span>' +
    '<span class="upsale-bundle-compare-price">' + fmt(offer.compareAtPrice) + '</span>' +
  '</div>';

upsertCodeNote(priceHost, offer);
upsertBundleItemsNote(priceHost, offer);
}

function paintBundlePrices() {
document.querySelectorAll('product-price[data-product-id]').forEach(function (priceComponent) {
if (!(priceComponent instanceof HTMLElement)) return;
var productId = String(priceComponent.dataset.productId || '');
if (!productId) return;
var offer = offerByProductId[productId];
if (!offer) return;
applyPriceOverride(priceComponent, offer);
});

findCardCandidates().forEach(function (node) {
if (!(node instanceof HTMLElement)) return;
var offer = findOfferForNode(node);
if (!offer) return;

var cardRoot = findCardRoot(node) || node;
var priceComponent = cardRoot.querySelector('product-price[data-product-id], [data-product-id] product-price');
if (priceComponent instanceof HTMLElement) {
  applyPriceOverride(priceComponent, offer);
  return;
}

applyFallbackPriceOverride(cardRoot, offer);
});
}

function replaceSections(sections) {
if (!sections || typeof sections !== 'object') return;

Object.keys(sections).forEach(function (sectionId) {
var html = sections[sectionId];
if (typeof html !== 'string' || !html) return;

var parsed = new DOMParser().parseFromString(html, 'text/html');
var nextSection = parsed.getElementById('shopify-section-' + sectionId);
var currentSection = document.getElementById('shopify-section-' + sectionId);
if (nextSection && currentSection) {
currentSection.replaceWith(nextSection);
}
});
}

function wantedCodesFromCart(cart) {
if (!cart || !Array.isArray(cart.items)) return [];
var codes = [];
cart.items.forEach(function (item) {
var offer = offerByProductId[String(item.product_id || '')];
if (offer && offer.code && codes.indexOf(offer.code) === -1) {
codes.push(offer.code);
}
});
return codes;
}

function syncBundleCodes() {
if (syncPromise) return syncPromise;

var cartUrl = (typeof FoxTheme !== 'undefined' && FoxTheme.routes && FoxTheme.routes.cart) ? FoxTheme.routes.cart : '/cart.js';
var cartUpdateUrl = (typeof FoxTheme !== 'undefined' && FoxTheme.routes && FoxTheme.routes.cart_update_url) ? FoxTheme.routes.cart_update_url : '/cart/update.js';

syncPromise = loadOffers().then(function () {
return fetch(cartUrl, { headers: { Accept: 'application/json' } });
}).then(function (response) {
return response.json();
}).then(function (cart) {
var wantedCodes = wantedCodesFromCart(cart);
if (wantedCodes.length === 0) return null;

var key = wantedCodes.slice().sort().join(',');
if (key === lastDiscountKey) return null;

var sections = [];
document.querySelectorAll('cart-items-component[data-section-id], cart-discount[data-section-id]').forEach(function (element) {
if (!(element instanceof HTMLElement)) return;
var sectionId = element.dataset.sectionId;
if (sectionId && sections.indexOf(sectionId) === -1) sections.push(sectionId);
});

return fetch(cartUpdateUrl, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
Accept: 'application/json'
},
body: JSON.stringify({
discount: wantedCodes.join(','),
sections: sections
})
}).then(function (response) {
return response.json();
}).then(function (payload) {
lastDiscountKey = key;
replaceSections(payload && payload.sections);
return payload;
});
}).catch(function (error) {
console.error('Failed to sync bundle offer discount codes:', error);
return null;
}).finally(function () {
syncPromise = null;
});

return syncPromise;
}

function scheduleRefresh() {
if (observerTimeout) window.clearTimeout(observerTimeout);
observerTimeout = window.setTimeout(function () {
loadOffers().then(function () {
paintBundlePrices();
syncBundleCodes();
});
}, 80);
}

function boot() {
loadOffers().then(function () {
paintBundlePrices();
syncBundleCodes();
});

document.addEventListener('cart:update', scheduleRefresh);
document.addEventListener('page:loaded', scheduleRefresh);
document.addEventListener('variant:update', scheduleRefresh);

observer = new MutationObserver(scheduleRefresh);
observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
boot();
}
})();
