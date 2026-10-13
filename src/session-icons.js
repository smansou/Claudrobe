  const SESSION_ICONS = [
    ['fox', 'Fox', '<path d="m4 11-1-8 7 5h4l7-5-1 8v5l-8 6-8-6Z"/><path d="m7 13 2 1m8-1-2 1m-5 3 2 2 2-2"/>'],
    ['cat', 'Cat', '<path d="M4 11V3l6 4h4l6-4v8c3 9-19 9-16 0Z"/><path d="M8 12h.1M16 12h.1m-6 3 2 2 2-2M3 15H1m22 0h-2"/>'],
    ['owl', 'Owl', '<path d="m4 5 4 2h8l4-2v10c0 9-16 9-16 0Z"/><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="m10 17 2 2 2-2"/>'],
    ['robot', 'Robot', '<rect x="4" y="7" width="16" height="14" rx="4"/><path d="M12 3v4M1 12v5m22-5v5M8 16h8"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>'],
    ['astronaut', 'Astronaut', '<circle cx="12" cy="12" r="10"/><rect x="5" y="6" width="14" height="10" rx="4"/><path d="M8 19h8M8 10h2"/>'],
    ['rocket', 'Rocket', '<path d="M9 15C7 9 13 3 21 3c0 8-6 14-12 12Zm0 0-5 1 1-5 4-2m6 6-2 4-5 1 1-5M6 18l-3 3"/><circle cx="16" cy="8" r="2"/>'],
    ['sprout', 'Sprout', '<path d="M12 21V11C5 12 3 8 3 3c6 0 9 2 9 8Zm0 4c0-6 3-9 9-9 0 6-3 9-9 9Z"/>'],
    ['mountain', 'Mountain', '<path d="m2 21 8-17 6 11 2-4 4 10Zm5-11 3 2 3-2"/>'],
  ];
  const PERSONALIZE_ICON = '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m8 15 1-4 7-7 3 3-7 7-4 1Zm6-9 3 3"/>';
  const iconEntry = id => SESSION_ICONS.find(([key]) => key === id);
  const iconSVG = id => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconEntry(id)?.[2] || PERSONALIZE_ICON}</svg>`;
  const iconMask = id => `url("data:image/svg+xml,${encodeURIComponent(iconSVG(id))}")`;
  const LS_AVATARS = 'cdt:sessionIcons';
  const storedIcons = readJSON(LS_AVATARS, {});
  const sessionIcons = Object.fromEntries(Object.entries(storedIcons && typeof storedIcons === 'object' ? storedIcons : {})
    .filter(([id, icon]) => SID.test(id) && iconEntry(icon)));
  const iconForSession = id => iconEntry(sessionIcons[id]) ? sessionIcons[id] : null;
  function setSessionIcon(id, icon) {
    if (!id || !SID.test(id) || (icon && !iconEntry(icon))) return;
    if (icon) sessionIcons[id] = icon; else delete sessionIcons[id];
    writeJSON(LS_AVATARS, sessionIcons);
    paintRows();
  }
