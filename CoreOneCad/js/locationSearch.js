// js/locationSearch.js
// Search, formatting, and dropdown wiring for the Location field.
// Mirrors the existing Call Type search pattern (cadTypeSearch / cadTypeKey /
// cadTypeSelect in the main CAD script block) so dispatchers get the same
// keyboard nav, highlighting, and selection behavior they already know.
//
// Depends on LOCATIONS / LOCATIONS_BY_POSTAL from assets/data/locations.js
// being loaded first.

var locationActiveIdx = -1;

// ---- Formatting -----------------------------------------------------------

// [313] U.S. Route 13 (YOU TOOL) Sandy Shores
// [314] U.S. Route 13 / Cat-Claw Avenue Sandy Shores
function formatLocationLabel(loc) {
  if (!loc) return '';
  var tag = '';
  if (loc.landmark) {
    tag = ' (' + loc.landmark + ')';
  } else if (loc.crossStreet) {
    tag = ' / ' + loc.crossStreet;
  }
  var road = loc.road || 'Unknown Road';
  var area = loc.area ? ' • ' + loc.area : '';
  return loc.postal + ' ' + road + tag + area;
}

// Short form for narrative/audit-log lines and anywhere space is tight.
function formatLocationShort(loc) {
  if (!loc) return '';
  return loc.postal + ' ' + (loc.road || loc.area || '');
}

// ---- Search ----------------------------------------------------------------

var LOCATION_SEARCH_RESULT_CAP = 25;

function locationSearch(query) {
  var q = (query || '').trim().toUpperCase();
  if (!LOCATIONS || !LOCATIONS.length) return [];
  if (q.length === 0) return LOCATIONS.slice(0, LOCATION_SEARCH_RESULT_CAP);

  var matches = LOCATIONS.filter(function(l) {
    return l.postal.indexOf(q) !== -1 ||
           (l.road || '').toUpperCase().indexOf(q) !== -1 ||
           (l.landmark || '').toUpperCase().indexOf(q) !== -1 ||
           (l.crossStreet || '').toUpperCase().indexOf(q) !== -1 ||
           (l.area || '').toUpperCase().indexOf(q) !== -1;
  });

  // Exact/prefix postal matches first, then everything else in original order.
  matches.sort(function(a, b) {
    var aExact = a.postal === q ? 0 : (a.postal.indexOf(q) === 0 ? 1 : 2);
    var bExact = b.postal === q ? 0 : (b.postal.indexOf(q) === 0 ? 1 : 2);
    return aExact - bExact;
  });

  return matches.slice(0, LOCATION_SEARCH_RESULT_CAP);
}

// ---- Dropdown rendering / wiring -------------------------------------------
// Expects a text <input> and a sibling dropdown <div> with the given ids,
// same convention as #call-type-input / #cad-type-dropdown.

function locationHlMatch(str, q) {
  if (!q || !str) return str || '';
  var idx = str.toUpperCase().indexOf(q.toUpperCase());
  if (idx === -1) return str;
  return str.slice(0, idx) +
    '<span style="color:var(--accent);font-weight:bold;">' + str.slice(idx, idx + q.length) + '</span>' +
    str.slice(idx + q.length);
}

function locationDropdownId() { return 'location-dropdown'; }

function locationTypeSearch(input) {
  var dropdown = document.getElementById(locationDropdownId());
  if (!dropdown) return;
  var q = input.value.trim();
  var matches = locationSearch(q);
  locationActiveIdx = -1;

  if (matches.length === 0) {
    dropdown.innerHTML = '<div style="padding:10px 12px;color:var(--muted);font-size:12px;">No matching locations.</div>';
    dropdown.style.display = 'block';
    return;
  }

  var html = '';
  for (var i = 0; i < matches.length; i++) {
    var loc = matches[i];
    var label = formatLocationLabel(loc);
    html += '<div class="location-item" data-idx="' + i + '"' +
      ' onclick="locationSelect(' + i + ')" onmouseover="locationHover(' + i + ')"' +
      ' style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;cursor:pointer;border-bottom:1px solid #1c2128;">' +
      '<span style="font-size:13px;">' + locationHlMatch(label, q) + '</span>' +
      '<span style="font-family:monospace;font-size:11px;color:#8b949e;background:#21262d;padding:1px 6px;border-radius:3px;flex-shrink:0;margin-left:10px;">' + loc.postal + '</span>' +
    '</div>';
  }
  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
  // Cache the current match set so locationSelect/locationHover/locationKey
  // don't have to re-run the search to know what's on screen.
  dropdown.__matches = matches;
}

function locationHover(idx) {
  var dropdown = document.getElementById(locationDropdownId());
  if (!dropdown) return;
  var items = dropdown.querySelectorAll('.location-item');
  items.forEach(function(item, i) {
    item.style.background = (i === idx) ? '#1f293d' : '';
  });
  locationActiveIdx = idx;
}

function locationKey(e) {
  var dropdown = document.getElementById(locationDropdownId());
  if (!dropdown || dropdown.style.display === 'none') return;
  var items = dropdown.querySelectorAll('.location-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    locationActiveIdx = Math.min(locationActiveIdx + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    locationActiveIdx = Math.max(locationActiveIdx - 1, 0);
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    // Same fix as cadTypeKey in Client.html: if the user typed and hit
    // Enter/Tab without arrowing/hovering to highlight a result,
    // locationActiveIdx is still -1. Default to the top match (index 0)
    // when there's an actual query narrowing the list, so "204" + Enter
    // lands the best match instead of saving the bare typed text as an
    // unstructured location with no locationObj. Leave untouched/empty
    // fields alone — Tabbing past one (showing the full unfiltered list)
    // should not silently assign whatever's first in that list.
    var hasQuery = e.target && e.target.value && e.target.value.trim().length > 0;
    var idx = locationActiveIdx >= 0 ? locationActiveIdx : (hasQuery ? 0 : -1);
    if (idx >= 0 && items[idx]) {
      e.preventDefault();
      locationSelect(idx);
    }
    return;
  } else if (e.key === 'Escape') {
    dropdown.style.display = 'none';
    return;
  } else {
    return;
  }

  items.forEach(function(item, i) { item.style.background = (i === locationActiveIdx) ? '#1f293d' : ''; });
  if (items[locationActiveIdx]) items[locationActiveIdx].scrollIntoView({ block: 'nearest' });
}

// Hook point: assign window.onLocationSelected = function(loc) {...} from
// Client.html to wire this into saveCallProfileField / call.locationObj
// without this file needing to know about `call` or `state` at all.
function locationSelect(idx) {
  var dropdown = document.getElementById(locationDropdownId());
  if (!dropdown || !dropdown.__matches) return;
  var loc = dropdown.__matches[idx];
  if (!loc) return;
  dropdown.style.display = 'none';
  if (typeof window.onLocationSelected === 'function') {
    window.onLocationSelected(loc);
  }
}
