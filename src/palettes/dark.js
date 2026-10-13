/* ───────────────────────────────────────────────────────────────────────────
 * palettes/dark.js — The dark palettes.
 *
 * Row shape is [slug, label, matching built-in code theme, deep, base, text,
 * text2, muted, accent, border] with an optional 11th entry of per-palette
 * extras. Dark palettes are offered while the app is in dark mode.
 * ─────────────────────────────────────────────────────────────────────────── */


  // ── Palettes ───────────────────────────────────────────────────────────────
  // [slug, label, matching built-in code theme, deep, base, text, text2, muted,
  //  accent, border]
  const RAW = [
    ['andromeda','Andromeda','andromeda','#1B1D23','#23262E','#D5CED9','#D5CED9','#746F77','#00E8C6','#1B1D23'],
    ['ayu-dark','Ayu Dark','ayu-dark','#0d1017','#10141c','#bfbdb6','#5a6378','#5a6378','#e6b450','#1b1f29'],
    ['catppuccin-mocha','Catppuccin Mocha','catppuccin-mocha','#11111b','#1e1e2e','#cdd6f4','#bac2de','#6c7086','#89b4fa','#313244'],
    ['cobalt2','Cobalt2','','#122738','#193549','#FFFFFF','#AAAAAA','#AAAAAA','#0088FF','#0D3A58'],
    ['dracula','Dracula','dracula','#191a21','#282a36','#f8f8f2','#f8f8f2','#6272a4','#8be9fd','#44475a'],
    ['everforest-dark','Everforest Dark','everforest-dark','#272e33','#2d353b','#d3c6aa','#9aa79d','#7f897d','#a7c080','#21272b'],
    ['github-dark','GitHub Dark','github-dark','#010409','#0d1117','#e6edf3','#7d8590','#6e7681','#2f81f7','#30363d'],
    ['gruvbox-dark','Gruvbox Dark','gruvbox-dark-medium','#1d2021','#282828','#ebdbb2','#d5c4a1','#a89984','#83a598','#3c3836'],
    ['horizon','Horizon','houston','#16161C','#1C1E26','#D5D8DA','#D5D8DA','#6C6F93','#E95378','#1A1C23'],
    ['kanagawa','Kanagawa','kanagawa-wave','#16161D','#1F1F28','#DCD7BA','#DCD7BA','#54546D','#6A9589','#16161D'],
    ['material-ocean','Material Ocean','material-theme-ocean','#090B12','#0F111A','#BABED8','#BABED8','#525975','#80CBC4','#3B3F51'],
    ['monokai-pro','Monokai Pro','monokai','#19181a','#2d2a2e','#fcfcfa','#939293','#5b595c','#ffd866','#19181a'],
    ['night-owl','Night Owl','night-owl','#010D18','#011627','#D6DEEB','#D6DEEB','#4B6479','#80CBC4','#5F7E97'],
    ['nord','Nord','nord','#272c36','#2e3440','#d8dee9','#d8dee9','#4c566a','#88c0d0','#3b4252'],
    ['one-dark-pro','One Dark Pro','one-dark-pro','#1b1d23','#282c34','#abb2bf','#abb2bf','#495162','#61afef','#3e4452'],
    ['palenight','Palenight','material-theme-palenight','#262A39','#292D3E','#BFC7D5','#929ac9','#676E95','#82AAFF','#2E3245'],
    ['poimandres','Poimandres','poimandres','#1b1e28','#1b1e28','#a6accd','#a6accd','#767c9d','#ADD7FF','#303340'],
    ['rose-pine','Rosé Pine','rose-pine','#191724','#1f1d2e','#e0def4','#908caa','#6e6a86','#31748f','#26233a'],
    ['shades-of-purple','Shades of Purple','','#1E1E3F','#2D2B55','#FFFFFF','#A599E9','#A599E9','#B362FF','#222244'],
    ['solarized-dark','Solarized Dark','solarized-dark','#00171e','#002b36','#839496','#839496','#586e75','#268bd2','#073642'],
    ['synthwave-84',"Synthwave '84",'synthwave-84','#171520','#262335','#FFFFFF','#FFFFFF','#848BBD','#FF7EDB','#495495'],
    // From the Ghostty palette (ghostty-style.vercel.app/config/tiki-love-dark),
    // background values tuned by eye in the preview. Muted and accent are
    // deliberately swapped from the usual roles: labels take the amber, and
    // the accent is the quiet taupe.
    ['tiki-love-dark','Tiki Love Dark','','#14100C','#1B1510','#E8D5B7','#E8D5B7','#F0A84C','#817463','#3B2D20', {
      tint: 0.22,
      semantic: { red: '#E85A4F', orange: '#D4843E', yellow: '#F0A84C', green: '#6AAF5C',
                  teal: '#5C9A7A', blue: '#7AB89A', purple: '#F07A6F' },
    }],
    ['tokyo-night','Tokyo Night','tokyo-night','#101014','#1a1b26','#a9b1d6','#a9b1d6','#565f89','#7aa2f7','#3b4261'],
    ['tokyo-night-storm','Tokyo Night Storm','tokyo-night','#191d2b','#24283b','#c0caf5','#a9b1d6','#565f89','#7aa2f7','#3b4261'],
    ['vitesse-dark','Vitesse Dark','vitesse-dark','#121212','#121212','#cdc9bd','#858480','#959da5','#4d9375','#191919'],
    ['ayu-mirage','Ayu Mirage','ayu-mirage','#171b24','#1f2430','#cbccc6','#a6adba','#707a8c','#ffcc66','#404959', { brightness: 50, raised: '#2a3140' }],
    ['papercolor-dark','PaperColor Dark','','#171717','#262626','#d0d0d0','#bcbcbc','#808080','#5fafaf','#585858', { brightness: 50, raised: '#333333' }],
    ['gruvbox-dark-hard','Gruvbox Dark Hard','gruvbox-dark-medium','#141617','#1d2021','#ebdbb2','#d5c4a1','#a89984','#b8bb26','#504945', { brightness: 50, raised: '#32302f' }],
    ['zenburn','Zenburn','','#303030','#3f3f3f','#dcdccc','#c0c0a0','#92927e','#8cd0d3','#656555', { brightness: 50, raised: '#4a4a45' }],
    ['tomorrow-night','Tomorrow Night','','#17191b','#1d1f21','#c5c8c6','#b4b7b4','#969896','#81a2be','#44484b', { brightness: 50, raised: '#292c2f' }],
    ['oceanic-next','Oceanic Next','','#141f25','#1b2b34','#d8dee9','#a7adba','#65737e','#6699cc','#405462', { brightness: 50, raised: '#2a3c46' }],
    ['catppuccin-macchiato','Catppuccin Macchiato','catppuccin-macchiato','#181926','#24273a','#cad3f5','#b8c0e0','#8087a2','#8aadf4','#494d64', { brightness: 50, raised: '#363a4f' }],
  ];
