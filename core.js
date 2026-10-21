// human.json core: renders human.json as readable text, imports from GitHub/LinkedIn/JSON Resume,
// reads job descriptions and matches people to jobs.
// No DOM access, so build.cjs can run the exact same code to write the static files.
var OH = (function () {
  var FX = { EUR: 1, USD: 1.08, GBP: 0.85 };
  var ONCALL = { none: 0, light: 1, heavy: 2 };
  var LV = [0, 0.35, 0.5, 0.7, 0.85, 1];
  var SYM = { EUR: '€', USD: '$', GBP: '£' };
  var vocab = [], alias = {};

  function setVocab(v) {
    vocab = v; alias = {};
    v.forEach(function (s) { alias[s.name.toLowerCase()] = s.name; (s.aliases || []).forEach(function (a) { alias[a.toLowerCase()] = s.name; }); });
  }
  function norm(s) {
    var t = String(s).trim(), l = t.toLowerCase(), m = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    return alias[l] || (m && (alias[m[2].toLowerCase()] || alias[m[1].toLowerCase()])) || t;
  }
  function money(v, c) { return v == null ? '' : (SYM[c] || '') + Math.round(v).toLocaleString('en-US') + (SYM[c] ? '' : ' ' + c); }
  function k(v, c) { return v == null ? '?' : (SYM[c] || '') + Math.round(v / 1000) + 'k'; }
  function tz(o) { return 'UTC' + (o >= 0 ? '+' : '−') + Math.abs(o); }
  function list(a, empty) { return a && a.length ? a.join(', ') : (empty || 'not stated'); }
  function fmtDate(d) {
    if (!d) return '';
    var t = new Date(d + 'T00:00:00Z');
    return isNaN(t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  var STATUS = { looking: 'Looking now', open: 'Open', 'not-looking': 'Not looking' };
  // what a person can be open to, and what a request can be
  var TYPES = {
    job: { label: 'Jobs', noun: 'jobs', one: 'role' },
    freelance: { label: 'Freelance', noun: 'freelance work', one: 'project' },
    advising: { label: 'Advising', noun: 'advising', one: 'advisory role' },
    cofounder: { label: 'Cofounding', noun: 'cofounder roles', one: 'cofounder role' },
    investing: { label: 'Investing', noun: 'investment pitches', one: 'pitch' },
    speaking: { label: 'Speaking', noun: 'speaking invitations', one: 'invitation' },
    intro: { label: 'Introductions', noun: 'introductions', one: 'introduction' },
    sales: { label: 'Sales pitches', noun: 'sales pitches', one: 'pitch' },
    marketing: { label: 'Marketing pitches', noun: 'marketing pitches', one: 'pitch' },
    recruiting_agency: { label: 'Agency recruiters', noun: 'agency recruiters', one: 'agency pitch' }
  };
  // v0.2 files had one hiring block (looking_for); v0.3 has a list of things the person is open to
  function normalize(p) {
    if (p && !p.open_to) p.open_to = p.looking_for ? [Object.assign({ type: 'job', status: p.status || 'looking' }, p.looking_for)] : [];
    if (p && !p.not_open_to) p.not_open_to = [];
    return p;
  }
  function intent(p, type) { return (normalize(p).open_to || []).filter(function (i) { return i.type === type; })[0] || null; }
  function jobOf(p) { return intent(p, 'job') || {}; }
  function typeLabel(t) { return (TYPES[t] || { noun: String(t).replace(/_/g, ' ') }).noun; }

  function payLine(lf) {
    var c = lf.comp || {};
    if (c.base_min != null) return 'Base from ' + money(c.base_min, c.currency) + (c.target ? ', target ' + money(c.target, c.currency) : '') + ' (' + c.currency + ', public).';
    return 'Pay is discussed with me directly. Please include your published band.';
  }

  // ---------- human.json as readable text (for people, and for pasting into any AI) ----------
  function toText(p, o) {
    o = o || {};
    normalize(p);
    var lf = jobOf(p), pol = p.agent_policy || {}, L = [];
    var byId = {}; (p.projects || []).forEach(function (x) { byId[x.id] = x; });
    L.push('# ' + p.name + (p.pronouns ? ' (' + p.pronouns + ')' : ''));
    L.push('');
    L.push('> ' + p.headline + ' ' + (STATUS[p.status] || '') + (lf.start ? ', can start ' + fmtDate(lf.start) : '') + '. Based in ' + p.location.city + ' (' + tz(p.location.utc_offset) + '). Open to: ' + (p.open_to.map(function (i) { return typeLabel(i.type); }).join(', ') || 'nothing right now') + '.');
    L.push('');
    L.push(p.summary);
    L.push('');
    L.push('A readable copy of ' + p.name.split(' ')[0] + '\'s human.json profile' + (o.url ? ' ([human.json](' + o.url + '))' : '') + ', spec ' + String(p.spec || 'human.json/0.4').replace(/^(human\.json|hellohuman|approach|open-hire)\//, 'v') + (o.protocol ? ' (' + o.protocol + ')' : '') + '. Updated ' + p.updated + '.' + (o.sample ? ' Fictional sample profile.' : ''));
    L.push('');
    L.push('## For agents');
    L.push('- Find what you\'re asking for under "What I\'m open to" and check its conditions first. If it\'s under "Not open to", or not listed at all, the answer is no.');
    L.push('- ' + (pol.auto_decline ? 'You may decline on my behalf when a hard check fails. Say which one; do not contact me.' : 'Please pass every role to me, even when a check fails.'));
    if (pol.intro_requires && pol.intro_requires.length) L.push('- Before an intro I need: ' + pol.intro_requires.map(function (r) { return REQ[r] || r; }).join('; ') + '.');
    if (pol.escalate && pol.escalate.length) L.push('- Leave these to me, don\'t negotiate them: ' + pol.escalate.join('; ') + '.');
    if (pol.contact) L.push('- Contact: ' + pol.contact.method + ' ' + (pol.contact.address || pol.contact.url || '') + (pol.contact.subject_prefix ? ', subject starting "' + pol.contact.subject_prefix + '"' : '') + '. One message per request.' + (pol.response_time ? ' I reply within ' + pol.response_time + '.' : ''));
    if (pol.feedback && pol.feedback.url) L.push('- After you decide, tell me why: POST a short structured note (verdict, the checks that decided it, what was missing) to ' + pol.feedback.url + '. It\'s how I learn what to change.');
    if ((p.languages || []).length) L.push('- Write to me in ' + p.languages.map(function (x) { return x.tag + (x.level ? ' (' + x.level + ')' : ''); }).join(', ') + ', in that order of preference.');
    var av = p.availability || {};
    if (av.away_until) L.push('- I\'m away until ' + fmtDate(av.away_until) + '. Don\'t expect a reply or follow up before then.' + (av.note ? ' ' + av.note : ''));
    if (av.booking_url) L.push('- If a request passes every check, offer a time with me: ' + av.booking_url);
    if ((p.identities || []).length) L.push('- My other accounts (trust one only if it links back to this file): ' + p.identities.map(function (x) { return x.url; }).join(', '));
    if (pol.notes) L.push('- ' + pol.notes);
    L.push('');
    L.push('## What I\'m open to');
    p.open_to.forEach(function (it) {
      L.push('');
      L.push('### ' + ((TYPES[it.type] || {}).label || it.type) + (it.status ? ' (' + (STATUS[it.status] || it.status).toLowerCase() + ')' : ''));
      intentLines(p, it).forEach(function (x) { L.push('- ' + x); });
    });
    if (!p.open_to.length) L.push('Nothing right now.');
    if (p.not_open_to.length) { L.push(''); L.push('## Not open to'); L.push('Decline these for me without contacting me: ' + p.not_open_to.map(typeLabel).join(', ') + '.'); }
    L.push('');
    L.push('## Skills');
    L.push('Level 1-5. Each skill links to the projects that show it; a skill with no project is a claim without proof.');
    (p.skills || []).slice().sort(function (a, b) { return b.level - a.level || b.years - a.years; }).forEach(function (s) {
      var ev = (s.evidence || []).filter(function (e) { return byId[e]; }).map(function (e) { return '[' + byId[e].title + '](#' + e + ')'; });
      L.push('- ' + s.name + ': ' + s.level + '/5, ' + s.years + ' yr' + (s.years === 1 ? '' : 's') + '. ' + (ev.length ? 'Shown in ' + ev.join(', ') + '.' : 'No project linked yet.'));
    });
    L.push('');
    L.push('## Projects');
    (p.projects || []).forEach(function (x) {
      L.push('');
      L.push('### ' + x.title + ' (' + x.year + ') {#' + x.id + '}');
      if (x.role) L.push('Role: ' + x.role + '.');
      L.push(x.summary);
      if (x.outcome) L.push('Outcome: ' + x.outcome);
      if (x.stack && x.stack.length) L.push('Skills: ' + x.stack.join(', ') + '.');
      if (x.link) L.push('Link: ' + x.link);
      if (x.source) L.push('Source: ' + ({ github: 'public GitHub repository (checkable)', linkedin: 'LinkedIn export (self-reported)', 'json-resume': 'JSON Resume (self-reported)' }[x.source] || x.source) + '.');
    });
    L.push('');
    L.push('## Experience');
    (p.experience || []).forEach(function (e) { L.push('- ' + e.from + '-' + e.to + ': ' + e.title + ', ' + e.org + '. ' + (e.summary || '')); });
    L.push('');
    L.push('## Common questions');
    L.push('Quote these answers rather than asking me again.');
    (p.faq || []).forEach(function (f) { L.push(''); L.push('### ' + f.q); L.push(f.a); });
    if (p.references && p.references.length) {
      L.push('');
      L.push('## References');
      p.references.forEach(function (r) { L.push('- ' + r.name + ', ' + r.relation + ': "' + r.quote + '" Contact ' + (r.contact || 'on request') + '.'); });
    }
    if (p.links && p.links.length) {
      L.push('');
      L.push('## Links');
      p.links.forEach(function (l) { L.push('- [' + l.label + '](' + l.url + ')'); });
    }
    return L.join('\n') + '\n';
  }

  function rateLine(r) {
    if (!r) return 'not stated';
    if (r.day_min != null) return 'from ' + money(r.day_min, r.currency) + ' a day.';
    return 'discussed with me directly; please include your rate.';
  }
  function intentLines(p, it) {
    var L = [], where = (it.work_mode || []).map(function (m) {
      if (m === 'remote') return 'remote' + (it.max_tz_diff_hours != null ? ' (within ' + it.max_tz_diff_hours + 'h of ' + tz(p.location.utc_offset) + ')' : '');
      return m + ' in ' + list(it.locations, p.location.city);
    });
    if (it.type === 'job') {
      L.push('Roles: ' + list(it.roles));
      L.push('Seniority: ' + (it.seniority || 'not stated') + '. Employment: ' + list(it.employment) + '.');
      L.push('Where: ' + list(where) + (it.relocate ? '. Open to relocating.' : '. Not relocating.'));
      L.push('Work authorisation: ' + list(it.work_auth) + '. ' + (it.needs_sponsorship ? 'Needs visa sponsorship.' : 'No sponsorship needed.'));
      L.push('Pay: ' + payLine(it));
      if (it.stages && it.stages.length) L.push('Company stage: ' + list(it.stages) + '.');
      if (it.max_on_call) L.push('On-call: ' + it.max_on_call + ' at most.');
    } else if (it.type === 'freelance') {
      L.push('Rate: ' + rateLine(it.rate));
      if (it.max_days_per_week != null) L.push('Up to ' + it.max_days_per_week + ' days a week.');
      if (it.min_weeks != null || it.max_weeks != null) L.push('Projects of ' + (it.min_weeks || 1) + ' to ' + (it.max_weeks || 52) + ' weeks.');
      if (where.length) L.push('Where: ' + list(where) + '.');
    } else if (it.type === 'advising') {
      if (it.max_hours_per_month != null) L.push('Up to ' + it.max_hours_per_month + ' hours a month.');
      if (it.comp && it.comp.length) L.push('Compensation: ' + list(it.comp) + '.');
      if (it.stages && it.stages.length) L.push('Company stage: ' + list(it.stages) + '.');
    }
    if (it.start) L.push('Earliest start: ' + fmtDate(it.start) + '.');
    if (it.domains_prefer && it.domains_prefer.length) L.push('Drawn to: ' + list(it.domains_prefer) + '.');
    if (it.domains_avoid && it.domains_avoid.length) L.push('Won\'t work in: ' + list(it.domains_avoid) + '.');
    (it.deal_breakers || []).forEach(function (d) { L.push('Deal-breaker: ' + d); });
    (it.nice_to_haves || []).forEach(function (d) { L.push('Nice to have: ' + d); });
    if ((it.topics || []).length) L.push('Topics: ' + it.topics.join(', ') + '.');
    if (it.notes) L.push(it.notes);
    return L;
  }

  function directoryTxt(people, jobs) {
    var L = ['# human.json directory', '',
      '> human.json is an open format for hiring profiles: one human.json per person with what they have done, what they want next, and the rules recruiting agents should follow. This site makes, checks and hosts them. The people below are fictional samples.', '',
      'Read [protocol.md](protocol.md) (the spec) and [schema/human.schema.json](schema/human.schema.json). Validate a file with `POST /api/validate`. Published profiles live at `/u/<handle>/human.json`. To help someone write theirs, follow [skill/SKILL.md](skill/SKILL.md). [people.json](people.json) summarises the samples; skill names come from [vocabulary.json](vocabulary.json).', '',
      '## People'];
    people.forEach(function (p) {
      L.push('- [' + p.name + '](p/' + p.handle + '/human.json): ' + p.headline.split('.')[0] + '. ' + p.location.city + ', ' + (STATUS[p.status] || p.status).toLowerCase() + '.');
    });
    L.push('', '## Sample requests', 'Jobs, freelance projects, advisory roles and a sales pitch, in [requests.json](requests.json), in the shape the protocol expects.');
    (jobs || []).forEach(function (j) { L.push('- ' + (TYPES[j.type || 'job'] || {}).label + ': ' + j.title + ' at ' + j.company); });
    return L.join('\n') + '\n';
  }

  function summary(p) {
    normalize(p);
    var lf = jobOf(p);
    return {
      handle: p.handle, name: p.name, headline: p.headline, city: p.location.city, country: p.location.country,
      utc_offset: p.location.utc_offset, status: p.status, updated: p.updated, roles: lf.roles || [], seniority: lf.seniority,
      work_mode: lf.work_mode || [], open_to: p.open_to.map(function (i) { return i.type; }), not_open_to: p.not_open_to, top_skills: (p.skills || []).slice().sort(function (a, b) { return b.level - a.level; }).slice(0, 6).map(function (s) { return s.name; }),
      human_json: 'p/' + p.handle + '/human.json'
    };
  }

  // ---------- matching ----------
  var REQ = { written_jd: 'a written description', published_comp: 'the published pay or rate', named_hiring_manager: 'the name of the person I\'d work with' };
  var STOP = 'a an the and or of to in for on with at by from you your have has had do does did is are was were be been it its this that what how why when who which we our us i me my can could would will about any some as if into over than then there these those they them not no yes ever so open year years team work worked working experience role roles company done much many kind best like look looks tell describe'.split(' ');
  var STOPS = {}; STOP.forEach(function (w) { STOPS[w] = 1; });
  function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9+#/\- ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1 && !STOPS[w]; }); }

  function stem(w) { for (var i = 0; i < 2; i++) w = w.length > 4 ? w.replace(/(ments?|ings?|ers?|ed|es|s|e)$/, '') : w; return w; }
  function same(a, b) { return a === b || stem(a) === stem(b); }
  function faqFor(p, q) {
    var qw = words(q), best = null, bs = 0;
    function has(w) { return qw.some(function (x) { return same(x, w); }); }
    (p.faq || []).forEach(function (f) {
      var s = 0;
      words(f.q).forEach(function (w) { if (has(w)) s += 1; });
      (f.tags || []).forEach(function (t) { var tw = words(t); if (tw.length && tw.every(has)) s += 2.5; });
      if (s > bs) { bs = s; best = f; }
    });
    return bs >= 2.5 ? best : null;
  }

  function checks(p, j, lf) {
    var type = j.type || 'job';
    lf = lf || jobOf(p);
    var off = p.location.utc_offset, C = [], R = (TYPES[type] || {}).one || 'request', Rc = R.charAt(0).toUpperCase() + R.slice(1);
    function add(id, label, status, detail) { C.push({ id: id, label: label, status: status, detail: detail }); }
    // work mode
    if (!j.work_mode) { if (type === 'job' || type === 'freelance') add('mode', 'Work mode', 'unknown', 'The ' + R + ' doesn\'t say remote, hybrid or onsite.'); }
    else add('mode', 'Work mode', (lf.work_mode || []).indexOf(j.work_mode) >= 0 ? 'pass' : 'fail',
      Rc + ' is ' + j.work_mode + '; ' + p.name.split(' ')[0] + ' wants ' + list(lf.work_mode) + '.');
    // place
    if (j.work_mode === 'remote') {
      var r = j.tz_utc_range;
      if (!r) add('place', 'Time zone', 'unknown', 'The ' + R + ' doesn\'t say which time zones it hires in.');
      else {
        var inR = off >= r[0] && off <= r[1], mid = (r[0] + r[1]) / 2, near = lf.max_tz_diff_hours == null || Math.abs(mid - off) <= lf.max_tz_diff_hours;
        add('place', 'Time zone', inR && near ? 'pass' : 'fail', p.location.city + ' is ' + tz(off) + '; the ' + R + ' hires ' + tz(r[0]) + ' to ' + tz(r[1]) + (inR && !near ? ', too far from the team for them' : '') + '.');
      }
    } else if (j.work_mode) {
      var mine = (lf.locations || []).concat([p.location.city]).map(function (c) { return c.toLowerCase(); });
      var hit = (j.locations || []).filter(function (c) { return mine.indexOf(c.toLowerCase()) >= 0; });
      if (!(j.locations || []).length) add('place', 'Location', 'unknown', 'The ' + R + ' doesn\'t name a city.');
      else if (hit.length) add('place', 'Location', 'pass', 'Office in ' + hit[0] + ', where they\'d work ' + j.work_mode + '.');
      else add('place', 'Location', lf.relocate ? 'pass' : 'fail', 'Office in ' + j.locations.join(' or ') + (lf.relocate ? '; they\'re open to relocating.' : '; they\'re in ' + p.location.city + ' and not relocating.'));
    }
    // work authorisation (employment only)
    if (type === 'job') {
    var auth = lf.work_auth || [];
    if (!j.hire_in || !j.hire_in.length) add('auth', 'Right to work', 'unknown', 'The ' + R + ' doesn\'t say where it can employ people.');
    else {
      var ok = auth.some(function (a) { return j.hire_in.indexOf(a) >= 0; });
      if (ok) add('auth', 'Right to work', 'pass', 'Can already work in ' + auth.filter(function (a) { return j.hire_in.indexOf(a) >= 0; }).join(', ') + '.');
      else if (j.visa_sponsorship && j.work_mode !== 'remote') add('auth', 'Right to work', 'pass', 'Needs a visa; the role sponsors.');
      else add('auth', 'Right to work', 'fail', Rc + ' employs in ' + j.hire_in.join(', ') + '; they can work in ' + list(auth, 'none listed') + (j.visa_sponsorship ? '. Sponsorship doesn\'t apply to remote hires.' : ' and the ' + R + ' doesn\'t sponsor.'));
    }
    }
    // pay
    if (type === 'job') {
    var c = lf.comp || {}, jc = j.comp || {};
    if (jc.base_max == null) add('pay', 'Pay', 'unknown', 'The ' + R + ' doesn\'t publish a pay band, so this can\'t be checked.');
    else if (c.base_min == null) add('pay', 'Pay', 'unknown', 'They discuss pay in person; the band is ' + k(jc.base_min, jc.currency) + '-' + k(jc.base_max, jc.currency) + '.');
    else {
      var maxE = jc.base_max / (FX[jc.currency] || 1), minE = c.base_min / (FX[c.currency] || 1), okp = maxE >= minE;
      var band = k(jc.base_min, jc.currency) + '-' + k(jc.base_max, jc.currency);
      var det = 'Band ' + band + (okp ? ' reaches' : ' is below') + ' their minimum of ' + k(c.base_min, c.currency) + '.';
      add('pay', 'Pay', okp ? 'pass' : 'fail', det);
    }
    }
    if (j.employment) add('employment', 'Employment', (lf.employment || []).indexOf(j.employment) >= 0 ? 'pass' : 'fail', Rc + ' is ' + j.employment + '; they want ' + list(lf.employment) + '.');
    if (j.stage && lf.stages && lf.stages.length) add('stage', 'Company stage', lf.stages.indexOf(j.stage) >= 0 ? 'pass' : 'fail', j.company + ' is ' + j.stage + '; they want ' + list(lf.stages) + '.');
    var bad = (j.domain || []).filter(function (d) { return (lf.domains_avoid || []).indexOf(d) >= 0; });
    if ((j.domain || []).length) add('domain', 'Domain', bad.length ? 'fail' : 'pass', bad.length ? Rc + ' is in ' + bad.join(', ') + ', which they won\'t work in.' : Rc + ' is in ' + j.domain.join(', ') + (((lf.domains_prefer || []).some(function (d) { return j.domain.indexOf(d) >= 0; })) ? ', a domain they\'re drawn to.' : '.'));
    if (j.on_call && lf.max_on_call) add('oncall', 'On-call', ONCALL[j.on_call] <= ONCALL[lf.max_on_call] ? 'pass' : 'fail', Rc + ' has ' + j.on_call + ' on-call; their limit is ' + lf.max_on_call + '.');
    if (j.start && lf.start) add('start', 'Start date', j.start >= lf.start ? 'pass' : 'unknown', j.start >= lf.start ? Rc + ' starts ' + fmtDate(j.start) + '; they\'re free from ' + fmtDate(lf.start) + '.' : Rc + ' wants ' + fmtDate(j.start) + '; they\'re free from ' + fmtDate(lf.start) + '. Ask if it can move.');
    // freelance: day rate, days a week, length
    if (type === 'freelance') {
      var fr = lf.rate || {}, jr = j.rate || {};
      if (jr.day_max == null) add('rate', 'Rate', 'unknown', 'The project doesn\'t publish a day rate.');
      else if (fr.day_min == null) add('rate', 'Rate', 'unknown', 'They discuss rates in person; the project pays up to ' + money(jr.day_max, jr.currency) + ' a day.');
      else {
        var okr = jr.day_max / (FX[jr.currency] || 1) >= fr.day_min / (FX[fr.currency] || 1);
        add('rate', 'Rate', okr ? 'pass' : 'fail', 'Up to ' + money(jr.day_max, jr.currency) + ' a day ' + (okr ? 'reaches' : 'is below') + ' their minimum of ' + money(fr.day_min, fr.currency) + '.');
      }
      if (j.days_per_week != null && lf.max_days_per_week != null) add('days', 'Days a week', j.days_per_week <= lf.max_days_per_week ? 'pass' : 'fail', j.days_per_week + ' days a week; they do up to ' + lf.max_days_per_week + '.');
      if (j.weeks != null && (lf.min_weeks != null || lf.max_weeks != null)) { var okw = j.weeks >= (lf.min_weeks || 0) && j.weeks <= (lf.max_weeks || 999); add('length', 'Length', okw ? 'pass' : 'fail', j.weeks + ' weeks; they take ' + (lf.min_weeks || 1) + '-' + (lf.max_weeks || 52) + ' week projects.'); }
    }
    // advising: time and compensation
    if (type === 'advising') {
      if (j.hours_per_month != null && lf.max_hours_per_month != null) add('hours', 'Time', j.hours_per_month <= lf.max_hours_per_month ? 'pass' : 'fail', j.hours_per_month + ' hours a month; they give up to ' + lf.max_hours_per_month + '.');
      if (j.comp && (lf.comp || []).length) add('comp', 'Compensation', lf.comp.indexOf(j.comp) >= 0 ? 'pass' : 'fail', 'Offers ' + j.comp + '; they accept ' + list(lf.comp) + '.');
    }
    // intro, speaking, advising: what they want to talk about
    if ((lf.topics || []).length && type !== 'job' && type !== 'freelance') {
      var rw = words([j.title, j.summary, (j.topics || []).join(' ')].join(' '));
      var hitT = lf.topics.filter(function (t) { return (j.topics || []).some(function (x) { return x.toLowerCase() === t.toLowerCase(); }) || words(t).every(function (w) { return rw.some(function (x) { return same(x, w); }); }); });
      add('topic', 'Topic', hitT.length ? 'pass' : 'fail', hitT.length ? 'About ' + hitT.join(', ') + ', which they want to talk about.' : 'About ' + ((j.topics || []).join(', ') || j.title) + '; they want to talk about ' + list(lf.topics) + '.');
    }
    return C;
  }

  function skillFit(p, j) {
    var mine = {}, byId = {}, rows = [], tw = 0, ts = 0;
    (p.skills || []).forEach(function (s) { mine[norm(s.name)] = s; });
    (p.projects || []).forEach(function (x) { byId[x.id] = x; });
    function row(name, must) {
      var n = norm(name), s = mine[n], ev = s ? (s.evidence || []).map(function (e) { return byId[e]; }).filter(Boolean) : [];
      var sc = s ? LV[s.level] * (ev.length ? 1 : 0.5) : 0, w = must ? 1 : 0.4;
      tw += w; ts += w * sc;
      rows.push({ name: n, must: must, skill: s || null, evidence: ev, score: sc });
    }
    (j.must_have || []).forEach(function (s) { row(s, true); });
    (j.nice_to_have || []).forEach(function (s) { row(s, false); });
    return { fit: tw ? ts / tw : 0, rows: rows };
  }

  function match(p, j) {
    normalize(p);
    var type = j.type || 'job', it = intent(p, type), pol = p.agent_policy || {}, first = p.name.split(' ')[0];
    if (!it || p.not_open_to.indexOf(type) >= 0) {
      var why = p.not_open_to.indexOf(type) >= 0 ? first + ' asked not to be contacted about ' + typeLabel(type) + '.' : first + ' isn\'t open to ' + typeLabel(type) + ' right now.';
      var C0 = [{ id: 'open', label: 'Open to', status: 'fail', detail: why }];
      var r0 = { person: p, job: j, type: type, checks: C0, fit: 0, noSkills: true, skills: [], reqs: [], answered: [], open: [], escalate: [], fails: C0, unknowns: [], verdict: 'decline' };
      r0.message = message(r0);
      return r0;
    }
    var C = checks(p, j, it), S = skillFit(p, j), noSkills = !(j.must_have || []).length && !(j.nice_to_have || []).length;
    var paid = type === 'job' ? (j.comp && j.comp.base_max != null) : type === 'freelance' ? (j.rate && j.rate.day_max != null) : type === 'advising' ? !!j.comp : true;
    var reqs = (it.intro_requires || pol.intro_requires || []).map(function (r) {
      var ok = r === 'written_jd' ? !!(j.summary || j.source_text) : r === 'published_comp' ? paid : r === 'named_hiring_manager' ? !!(j.hiring_manager || j.contact_name) : true;
      return { id: r, label: REQ[r] || r, ok: ok };
    });
    var answered = [], open = [];
    (j.questions || []).forEach(function (q) { var f = faqFor(p, q); if (f) answered.push({ q: q, faq: f }); else open.push(q); });
    var jt = words([j.title, j.summary, j.seniority, (j.comp || {}).equity ? 'equity ' + j.comp.equity : '', j.employment, (j.locations || []).join(' ')].join(' '));
    var jw = {}; jt.forEach(function (w) { jw[w] = 1; });
    var esc = (pol.escalate || []).filter(function (e) { return words(e).some(function (w) { return jw[w] || (w.length > 4 && Object.keys(jw).some(function (x) { return x.indexOf(w.slice(0, 5)) === 0; })); }); });
    var fails = C.filter(function (c) { return c.status === 'fail'; });
    var unknowns = C.filter(function (c) { return c.status === 'unknown'; });
    var verdict = fails.length ? 'decline' : ((noSkills || S.fit >= 0.6) && reqs.every(function (r) { return r.ok; }) && !unknowns.some(function (u) { return u.id === 'pay' || u.id === 'rate'; })) ? 'intro' : 'maybe';
    var res = { person: p, job: j, type: type, noSkills: noSkills, checks: C, fit: noSkills ? 1 : S.fit, skills: S.rows, reqs: reqs, answered: answered, open: open, escalate: esc, fails: fails, unknowns: unknowns, verdict: verdict };
    res.message = message(res);
    return res;
  }

  // feedback: the note an agent sends back after deciding (spec: "Feedback")
  var FB_VERDICT = { intro: 'approached', maybe: 'asked', decline: 'declined' };
  function feedbackFor(r, agent) {
    var j = r.job || {}, jc = j.comp || {}, jr = j.rate || {}, off = null;
    var why = r.verdict === 'decline' ? r.fails : r.verdict === 'maybe' ? r.unknowns : r.checks.filter(function (c) { return c.status === 'pass'; }).slice(0, 3);
    if (jc.base_max != null) off = { currency: jc.currency, base_min: jc.base_min, base_max: jc.base_max };
    else if (jr.day_max != null) off = { currency: jr.currency, day_min: jr.day_min, day_max: jr.day_max };
    var missing = r.unknowns.map(function (u) { return u.id; }).concat((r.reqs || []).filter(function (q) { return !q.ok; }).map(function (q) { return q.id; }));
    if (missing.indexOf('pay') >= 0 || missing.indexOf('rate') >= 0) missing = missing.filter(function (m) { return m !== 'published_comp'; });
    if (r.verdict !== 'decline' && !r.noSkills && r.fit < 0.6) why = why.concat([{ id: 'skills', detail: 'Skill fit ' + Math.round(r.fit * 100) + '%.' }]);
    return {
      verdict: FB_VERDICT[r.verdict] || r.verdict,
      reasons: why.map(function (c) { return { check: c.id, detail: c.detail }; }),
      missing: uniq(missing),
      request: { type: r.type || 'job', title: j.title || '', company: j.company || '' },
      offered: off,
      agent: agent || { name: 'human.json demo', on_behalf_of: j.company || '' }
    };
  }
  function digest(notes) {
    var d = { total: notes.length, approached: 0, asked: 0, declined: 0, reasons: [], missing: [], near: [], offered: [], recent: notes.slice(-5).reverse() };
    var rc = {}, mc = {};
    notes.forEach(function (n) {
      d[n.verdict] = (d[n.verdict] || 0) + 1;
      if (n.verdict === 'declined') (n.reasons || []).forEach(function (x) { rc[x.check] = (rc[x.check] || 0) + 1; });
      (n.missing || []).forEach(function (m) { mc[m] = (mc[m] || 0) + 1; });
      if (n.verdict === 'declined' && (n.reasons || []).length === 1 && n.reasons[0].check !== 'open') d.near.push(n);
      if (n.offered) d.offered.push(n);
    });
    function top(o) { return Object.keys(o).map(function (key) { return { id: key, n: o[key] }; }).sort(function (a, b) { return b.n - a.n; }); }
    d.reasons = top(rc); d.missing = top(mc);
    return d;
  }

  var VERB = { intro: 'intro', maybe: 'maybe, needs you', decline: 'declined for you' };
  function message(r) {
    var p = r.person, j = r.job, first = p.name.split(' ')[0], pol = p.agent_policy || {}, L = [], jc = j.comp || {}, one = (TYPES[r.type || 'job'] || {}).one || 'request';
    var mark = { pass: '✓', fail: '✗', unknown: '?' };
    if (r.verdict === 'decline' && pol.auto_decline) {
      L.push('To: ' + (j.hiring_manager || j.contact_name || j.company));
      L.push('Subject: ' + j.title + ': not a fit for ' + p.name);
      L.push('');
      L.push('Thanks for thinking of ' + first + '. Their published preferences rule this ' + one + ' out:');
      r.fails.forEach(function (f) { L.push('  ✗ ' + f.label + ': ' + f.detail); });
      L.push('');
      L.push(first + ' asked agents to decline on their behalf in cases like this, so they haven\'t been contacted. If anything changes, their file will say so.');
      return L.join('\n');
    }
    L.push('To: ' + ((pol.contact && pol.contact.address) || p.name));
    L.push('Subject: ' + ((pol.contact && pol.contact.subject_prefix) ? pol.contact.subject_prefix + ' ' : '') + j.title + ' at ' + j.company + ' (' + VERB[r.verdict] + ')');
    L.push('');
    L.push('Hi ' + first + ', one message about one ' + one + '. I read your human.json; here\'s how it lines up.');
    L.push('');
    L.push('THE ' + one.toUpperCase());
    L.push('  ' + j.title + ' at ' + j.company + (j.stage ? ' (' + j.stage + ')' : '') + '. ' + (j.company_blurb || ''));
    var terms = r.type === 'freelance' ? (j.rate && j.rate.day_max != null ? 'up to ' + money(j.rate.day_max, j.rate.currency) + '/day' : 'rate not published') + (j.days_per_week ? ' · ' + j.days_per_week + ' days/week' : '') + (j.weeks ? ' · ' + j.weeks + ' weeks' : '')
      : r.type === 'advising' ? (j.hours_per_month ? j.hours_per_month + ' h/month' : 'time not stated') + ' · ' + (j.comp || 'compensation not stated')
      : (jc.base_max != null ? k(jc.base_min, jc.currency) + '-' + k(jc.base_max, jc.currency) + (jc.equity ? ' + ' + jc.equity + ' equity' : '') : 'pay not published');
    L.push('  ' + (j.work_mode ? j.work_mode + (j.locations && j.locations.length ? ', ' + j.locations.join('/') : '') + ' · ' : '') + terms + (j.start ? ' · start ' + fmtDate(j.start) : ''));
    L.push('  Contact: ' + (j.hiring_manager || j.contact_name || 'not named'));
    L.push('');
    L.push('YOUR CONDITIONS');
    r.checks.forEach(function (c) { L.push('  ' + mark[c.status] + ' ' + c.label + ': ' + c.detail); });
    L.push('');
    if (!r.noSkills) L.push('SKILLS THEY ASK FOR (fit ' + Math.round(r.fit * 100) + '%)');
    r.skills.forEach(function (s) {
      L.push('  ' + (s.skill ? '●' : '○') + ' ' + s.name + (s.must ? '' : ' (nice to have)') + ': ' + (s.skill ? 'you rate ' + s.skill.level + '/5' + (s.evidence.length ? ', shown in "' + s.evidence[0].title + '"' : ', no project linked') : 'not on your profile'));
    });
    if (r.answered.length) {
      L.push('');
      L.push('ANSWERED FROM YOUR FAQ (they\'ll get your words, not mine)');
      r.answered.forEach(function (a) { L.push('  Q: ' + a.q); L.push('  You: "' + a.faq.a + '"'); });
    }
    var opens = r.open.slice();
    r.unknowns.forEach(function (u) { opens.push(u.label + ': ' + u.detail); });
    r.reqs.filter(function (q) { return !q.ok; }).forEach(function (q) { opens.push('Missing ' + q.label + ', which you require before an intro.'); });
    r.escalate.forEach(function (e) { opens.push('You asked to handle "' + e + '" yourself.'); });
    if (opens.length) {
      L.push('');
      L.push('OPEN, ONLY YOU CAN ANSWER');
      opens.forEach(function (o) { L.push('  • ' + o); });
    }
    L.push('');
    L.push(r.verdict === 'intro' ? 'Reply "yes" and I\'ll set up a first call with ' + (j.hiring_manager || 'the team') + '. Reply "no" and that\'s the last you\'ll hear about it.'
      : r.verdict === 'decline' ? 'This fails one of your conditions, but your policy asks to see every role. Reply "no" to close it.'
      : 'Some of this is open, so I\'m asking rather than booking anything. Reply "yes", "no" or with an answer.');
    return L.join('\n');
  }

  // ---------- reading a pasted job description ----------
  var DOMAINS = { defense: /\b(defen[cs]e|military|weapons?|munitions)\b/i, climate: /\b(climate|carbon|renewable|energy transition|grid|emissions)\b/i, health: /\b(health|clinical|patients?|medical|hospital)\b/i, fintech: /\b(fintech|bank(ing)?|payments?|lending)\b/i, adtech: /\b(ad ?tech|advertising|ad targeting)\b/i, gambling: /\b(gambling|betting|casino|sportsbook)\b/i, crypto: /\b(crypto|web3|blockchain|defi)\b/i, education: /\b(education|edtech|learning platform|students)\b/i, science: /\b(research lab|biology|scientific|drug discovery)\b/i, devtools: /\b(developer tools?|devtools|open[- ]source (framework|tool))\b/i };
  var CITIES = ['Berlin', 'Amsterdam', 'London', 'Lisbon', 'Warsaw', 'Paris', 'Munich', 'Hamburg', 'Barcelona', 'Madrid', 'Dublin', 'Stockholm', 'Copenhagen', 'Zurich', 'Vienna', 'Prague', 'New York', 'San Francisco', 'Seattle', 'Austin', 'Boston', 'Toronto', 'Montreal', 'Vancouver', 'São Paulo', 'Bangalore', 'Lagos', 'Nairobi', 'Singapore', 'Sydney', 'Tokyo'];
  var CITY_TZ = { Berlin: 1, Amsterdam: 1, London: 0, Lisbon: 0, Warsaw: 1, Paris: 1, Munich: 1, Hamburg: 1, Barcelona: 1, Madrid: 1, Dublin: 0, Stockholm: 1, Copenhagen: 1, Zurich: 1, Vienna: 1, Prague: 1, 'New York': -5, 'San Francisco': -8, Seattle: -8, Austin: -6, Boston: -5, Toronto: -5, Montreal: -5, Vancouver: -8, 'São Paulo': -3, Bangalore: 5.5, Lagos: 1, Nairobi: 3, Singapore: 8, Sydney: 10, Tokyo: 9 };
  var CITY_REG = { London: 'UK', Dublin: 'EU', 'New York': 'US', 'San Francisco': 'US', Seattle: 'US', Austin: 'US', Boston: 'US', Toronto: 'CA', Montreal: 'CA', Vancouver: 'CA', 'São Paulo': 'BR', Bangalore: 'IN', Lagos: 'NG', Nairobi: 'KE', Singapore: 'SG', Sydney: 'AU', Tokyo: 'JP', Zurich: 'CH' };
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function findSkill(text, name, aliases) {
    var hits = [name].concat(aliases || []);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (h.length <= 3) { // short names: exact case, whole word ("Go" but not "go-to-market")
        if (new RegExp('(^|[^A-Za-z0-9+])' + esc(h) + '(?![A-Za-z0-9+\\-])').test(text)) return true;
      } else if (new RegExp('(^|[^a-z0-9])' + esc(h.toLowerCase()) + '(?![a-z0-9])').test(text.toLowerCase())) return true;
    }
    return false;
  }
  function num(a, b, kk) { var v = parseFloat(String(a).replace(/[, ]/g, '') + (b ? b : '')); if (kk || v < 1000) v *= 1000; return v; }

  function parseJD(text) {
    var t = String(text || ''), lines = t.split(/\n/).map(function (l) { return l.trim(); }), j = { source_text: t, questions: [], must_have: [], nice_to_have: [] };
    var first = lines.filter(Boolean)[0] || 'Pasted role';
    var mAt = first.match(/^(.*?)\s+(?:at|@|—|–|-|\|)\s+(.+)$/);
    j.title = (mAt ? mAt[1] : first).replace(/^#+\s*/, '').slice(0, 80);
    j.company = mAt ? mAt[2].replace(/[.,(].*$/, '').slice(0, 40) : (t.match(/\b(?:at|join)\s+([A-Z][A-Za-z0-9&]+(?:\s[A-Z][A-Za-z0-9&]+)?)/) || [0, 'the company'])[1];
    // skills: track whether we're in a "nice to have" section
    var nice = false, must = {}, nic = {};
    lines.forEach(function (l) {
      if (/^(#+\s*)?(nice|bonus|plus|preferred|good to have|would be great)/i.test(l) || /nice[- ]to[- ]have|bonus points/i.test(l) && l.length < 60) nice = true;
      else if (/^(#+\s*)?(requirements|must|you have|what you|you'll|we need|required|about you|responsibilities)/i.test(l)) nice = false;
      if (/\?\s*$/.test(l) && l.length < 200) j.questions.push(l.replace(/^[-*•\d.)\s]+/, ''));
      vocab.forEach(function (v) { if (v.name.length > 1 && findSkill(l, v.name, v.aliases)) (nice || /\b(nice|bonus|plus|ideally)\b/i.test(l) ? nic : must)[v.name] = 1; });
    });
    j.must_have = Object.keys(must);
    j.nice_to_have = Object.keys(nic).filter(function (s) { return !must[s]; });
    j.work_mode = /\bhybrid\b/i.test(t) ? 'hybrid' : /\b(on-?site|in[- ]office|in the office|five days)\b/i.test(t) ? 'onsite' : /\bremote\b/i.test(t) ? 'remote' : null;
    j.locations = CITIES.filter(function (c) { return new RegExp('\\b' + esc(c) + '\\b', 'i').test(t); });
    var cur = /€|\bEUR\b/.test(t) ? 'EUR' : /£|\bGBP\b/.test(t) ? 'GBP' : /\$|\bUSD\b/.test(t) ? 'USD' : null;
    var m = t.match(/[€$£]\s?(\d{2,3}(?:[,.\s]?\d{3})?)\s?(k)?\s?(?:-|–|—|to)\s?[€$£]?\s?(\d{2,3}(?:[,.\s]?\d{3})?)\s?(k)?/i);
    j.comp = m ? { currency: cur || 'EUR', base_min: num(m[1], '', m[2]), base_max: num(m[3], '', m[4] || m[2]), equity: (t.match(/(\d+(?:\.\d+)?\s?-\s?\d+(?:\.\d+)?%)/) || [])[1] || null } : { currency: cur, base_min: null, base_max: null };
    j.visa_sponsorship = /visa sponsorship|sponsor (your )?visa|we sponsor/i.test(t) && !/(no|not|unable to|cannot|can't|don't) (offer |provide )?(visa )?sponsor/i.test(t);
    j.on_call = /no on-?call/i.test(t) ? 'none' : /(24\/7|pager|heavy on-?call|weekly on-?call)/i.test(t) ? 'heavy' : /on-?call/i.test(t) ? 'light' : null;
    j.domain = Object.keys(DOMAINS).filter(function (d) { return DOMAINS[d].test(t); });
    var st = t.match(/\b(seed|series[- ]?a|series[- ]?b|series[- ]?c|pre-?ipo|publicly listed|public company|non-?profit)\b/i);
    j.stage = st ? st[1].toLowerCase().replace(/series[- ]?c|pre-?ipo/, 'growth').replace(/series[- ]?([ab])/, 'series-$1').replace(/publicly listed|public company/, 'public').replace(/non-?profit/, 'nonprofit') : null;
    var sen = t.match(/\b(principal|staff|lead|senior|mid-level|junior|head of)\b/i);
    j.seniority = sen ? sen[1].toLowerCase().replace('head of', 'head') : null;
    j.employment = /\bfreelance\b/i.test(t) ? 'freelance' : /\bcontract(or)?\b/i.test(t) && !/full[- ]time/i.test(t) ? 'contract' : /\bpart[- ]time\b/i.test(t) ? 'part-time' : 'full-time';
    var hm = t.match(/(?:[Hh]iring [Mm]anager|[Rr]eport(?:ing|s)? to)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-zA-Z'-]+)+)/);
    j.hiring_manager = hm ? hm[1] : null;
    var sd = t.match(/\b(20\d\d-\d\d-\d\d)\b/);
    j.start = sd ? sd[1] : null;
    var reg = [];
    if (/\b(EU|Europe(an)?|EMEA)\b/.test(t)) reg.push('EU');
    if (/\b(UK|United Kingdom)\b/.test(t)) reg.push('UK');
    if (/\b(US|USA|United States)\b/.test(t)) reg.push('US');
    if (/\bCanada\b/.test(t)) reg.push('CA');
    j.locations.forEach(function (c) { var r = CITY_REG[c] || 'EU'; if (reg.indexOf(r) < 0) reg.push(r); });
    if (!reg.length && cur) reg.push(cur === 'USD' ? 'US' : cur === 'GBP' ? 'UK' : 'EU');
    j.hire_in = reg;
    if (j.work_mode === 'remote') {
      var tzm = t.match(/UTC\s?([+−-]\d+)\s?(?:to|-|–)\s?(?:UTC\s?)?([+−-]?\d+)/i);
      j.tz_utc_range = tzm ? [parseInt(tzm[1].replace('−', '-')), parseInt(tzm[2].replace('−', '-'))]
        : reg.indexOf('EU') >= 0 || reg.indexOf('UK') >= 0 ? [-1, 3] : reg.indexOf('US') >= 0 || reg.indexOf('CA') >= 0 ? [-8, -4] : null;
    }
    j.summary = lines.filter(function (l) { return l.length > 60; })[0] || '';
    j.id = 'pasted'; j.pasted = true;
    return j;
  }

  // ---------- importing from what people already have ----------
  // GitHub (public API), a LinkedIn data export (CSV files), JSON Resume, or an existing human.json.
  // Each importer returns a partial human.json; mergeProfile folds it into a draft without overwriting.
  var MORE_TZ = { Portland: -8, 'Los Angeles': -8, Chicago: -6, Denver: -7, Atlanta: -5, Miami: -5, 'Mexico City': -6, 'Buenos Aires': -3, Bogotá: -5, Lima: -5, Cologne: 1, Frankfurt: 1, Stuttgart: 1, Rome: 1, Milan: 1, Brussels: 1, Oslo: 1, Helsinki: 2, Athens: 2, Kyiv: 2, Bucharest: 2, Istanbul: 3, 'Cape Town': 2, Cairo: 2, Dubai: 4, Karachi: 5, Lahore: 5, Islamabad: 5, Delhi: 5.5, 'New Delhi': 5.5, Mumbai: 5.5, Hyderabad: 5.5, Bengaluru: 5.5, Chennai: 5.5, Beijing: 8, Shanghai: 8, Seoul: 9, Melbourne: 10, Auckland: 12 };
  var COUNTRY = { germany: ['DE', 1], deutschland: ['DE', 1], netherlands: ['NL', 1], 'united kingdom': ['GB', 0], uk: ['GB', 0], england: ['GB', 0], portugal: ['PT', 0], poland: ['PL', 1], france: ['FR', 1], spain: ['ES', 1], italy: ['IT', 1], ireland: ['IE', 0], sweden: ['SE', 1], switzerland: ['CH', 1], austria: ['AT', 1], 'united states': ['US', -5], usa: ['US', -5], canada: ['CA', -5], brazil: ['BR', -3], india: ['IN', 5.5], nigeria: ['NG', 1], kenya: ['KE', 3], pakistan: ['PK', 5], singapore: ['SG', 8], japan: ['JP', 9], australia: ['AU', 10] };
  var US_STATE = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
  function place(s) {
    s = String(s || '').trim(); if (!s) return null;
    var parts = s.split(/\s*,\s*/), city = parts[0].replace(/\s+(area|metropolitan.*|region)$/i, '').replace(/^greater\s+/i, '').trim();
    var all = {}, k; for (k in CITY_TZ) all[k] = CITY_TZ[k]; for (k in MORE_TZ) all[k] = MORE_TZ[k];
    var hit = Object.keys(all).filter(function (c) { return c.toLowerCase() === city.toLowerCase(); })[0];
    var tail = (parts[parts.length - 1] || '').toLowerCase(), cc = COUNTRY[tail];
    var country = cc ? cc[0] : US_STATE.test(s) ? 'US' : (CITY_REG[hit] === 'UK' ? 'GB' : CITY_REG[hit] || '');
    var off = hit != null ? all[hit] : cc ? cc[1] : null;
    return { city: hit || city, country: country, utc_offset: off };
  }

  var LANG = { 'Jupyter Notebook': 'Python', HCL: 'Terraform', Vue: 'JavaScript', Svelte: 'JavaScript', 'Objective-C': 'Swift' };
  var NOT_SKILLS = { HTML: 1, CSS: 1, SCSS: 1, TeX: 1, MDX: 1, Makefile: 1, Dockerfile: 1, Batchfile: 1, Procfile: 1, Roff: 1, 'Rich Text Format': 1 };
  function skillsIn(text) {
    var out = [];
    vocab.forEach(function (v) { if (v.name.length > 1 && findSkill(String(text || ''), v.name, v.aliases)) out.push(v.name); });
    return out;
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { return x && !s[x] && (s[x] = 1); }); }
  function slugify(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'; }
  function yearOf(s) { var m = String(s || '').match(/(19|20)\d\d/); return m ? +m[0] : null; }
  function levelFor(share) { return share >= 0.3 ? 5 : share >= 0.15 ? 4 : share >= 0.05 ? 3 : 2; }

  // user = GET /users/:u, repos = GET /users/:u/repos?per_page=100&sort=pushed
  function fromGitHub(user, repos, today) {
    var nowY = +(today || new Date().toISOString()).slice(0, 4);
    var own = (repos || []).filter(function (r) { return !r.fork; });
    var byLang = {}, total = 0;
    own.forEach(function (r) {
      if (!r.language || NOT_SKILLS[r.language]) return;
      var l = LANG[r.language] || norm(r.language), a = yearOf(r.created_at) || nowY, z = yearOf(r.pushed_at) || a; total++;
      byLang[l] = byLang[l] || { n: 0, first: a, last: z }; byLang[l].n++; byLang[l].first = Math.min(byLang[l].first, a); byLang[l].last = Math.max(byLang[l].last, z);
    });
    // projects: the repos most worth showing (stars first, then recent activity)
    var picks = own.filter(function (r) { return r.description || r.stargazers_count; })
      .sort(function (a, b) { return (b.stargazers_count - a.stargazers_count) || String(b.pushed_at).localeCompare(String(a.pushed_at)); }).slice(0, 6);
    var projects = picks.map(function (r) {
      var lang = r.language && !NOT_SKILLS[r.language] && (LANG[r.language] || norm(r.language));
      return { id: 'gh-' + slugify(r.name), title: r.name, year: yearOf(r.pushed_at) || yearOf(r.created_at) || nowY, role: 'Author', summary: r.description || 'Public repository.',
        outcome: r.stargazers_count ? r.stargazers_count.toLocaleString('en-US') + (r.stargazers_count === 1 ? ' star' : ' stars') + (r.forks_count ? ' and ' + r.forks_count.toLocaleString('en-US') + (r.forks_count === 1 ? ' fork' : ' forks') : '') + ' on GitHub.' : '',
        stack: uniq([lang].concat((r.topics || []).map(function (t) { var n = norm(t.replace(/-/g, ' ')); return alias[n.toLowerCase()] ? n : null; })).concat(skillsIn(r.description))), link: r.html_url, source: 'github' };
    });
    var skills = Object.keys(byLang).map(function (l) {
      return { name: l, level: levelFor(byLang[l].n / Math.max(1, total)), years: Math.max(1, Math.min(20, byLang[l].last - byLang[l].first + 1)), evidence: [] };
    });
    projects.forEach(function (x) { x.stack.forEach(function (s) { if (!skills.some(function (k) { return k.name === s; })) skills.push({ name: s, level: 3, years: 1, evidence: [] }); }); });
    skills.forEach(function (s) { s.evidence = projects.filter(function (x) { return x.stack.indexOf(s.name) >= 0; }).map(function (x) { return x.id; }); });
    skills.sort(function (a, b) { return b.level - a.level || b.years - a.years; });
    var links = [{ label: 'GitHub', url: user.html_url || 'https://github.com/' + user.login }];
    if (user.blog) links.push({ label: 'Website', url: /^https?:/.test(user.blog) ? user.blog : 'https://' + user.blog });
    return { name: user.name || user.login, headline: user.bio || '', photo: /^https:\/\//.test(user.avatar_url || '') ? user.avatar_url : undefined, summary: '', location: place(user.location), links: links, identities: [{ label: 'GitHub', url: 'https://github.com/' + user.login }], skills: skills, projects: projects,
      experience: [],
      sources: [{ type: 'github', ref: user.html_url || 'https://github.com/' + user.login, imported: (today || new Date().toISOString()).slice(0, 10) }] };
  }

  // RFC 4180-ish CSV with quoted fields and newlines inside quotes
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, t = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
    // LinkedIn puts a "Notes:" preamble above some tables; the header is the first row with several columns
    var widest = Math.max.apply(null, rows.map(function (r) { return r.length; }).concat([0])), h = 0;
    while (h < rows.length - 1 && rows[h].length < widest) h++;
    var head = (rows[h] || []).map(function (x) { return x.trim(); });
    return rows.slice(h + 1).map(function (r) { var o = {}; head.forEach(function (k, j) { o[k] = (r[j] || '').trim(); }); return o; });
  }

  // files: { 'Profile.csv': text, 'Positions.csv': text, ... } from LinkedIn's "Get a copy of your data"
  function fromLinkedIn(files, today) {
    var get = function (n) { var k = Object.keys(files).filter(function (f) { return f.split('/').pop().toLowerCase() === n.toLowerCase(); })[0]; return k ? parseCSV(files[k]) : []; };
    var prof = get('Profile.csv')[0] || {}, pos = get('Positions.csv'), sk = get('Skills.csv'), pr = get('Projects.csv'), rec = get('Recommendations_Received.csv');
    var nowY = +(today || new Date().toISOString()).slice(0, 4);
    var experience = pos.map(function (p) {
      return { org: p['Company Name'] || '', title: p.Title || '', from: String(yearOf(p['Started On']) || ''), to: p['Finished On'] ? String(yearOf(p['Finished On']) || '') : 'now', summary: (p.Description || '').replace(/\s+/g, ' ').slice(0, 280) };
    }).filter(function (e) { return e.org || e.title; });
    var projects = pr.map(function (p) {
      return { id: 'li-' + slugify(p.Title), title: p.Title || '', year: yearOf(p['Finished On']) || yearOf(p['Started On']) || nowY, role: '', summary: (p.Description || '').replace(/\s+/g, ' ').slice(0, 400), outcome: '', stack: skillsIn((p.Title || '') + '\n' + (p.Description || '')), link: p.Url || '', source: 'linkedin' };
    }).filter(function (x) { return x.title; });
    // years for a skill: span of the positions that mention it; otherwise unknown (1)
    var skills = uniq(sk.map(function (s) { return norm(s.Name); })).map(function (n) {
      var span = pos.filter(function (p) { return findSkill((p.Title || '') + '\n' + (p.Description || ''), n, (vocab.filter(function (v) { return v.name === n; })[0] || {}).aliases); });
      var from = Math.min.apply(null, span.map(function (p) { return yearOf(p['Started On']) || nowY; }).concat([nowY]));
      var to = Math.max.apply(null, span.map(function (p) { return p['Finished On'] ? yearOf(p['Finished On']) || nowY : nowY; }).concat([from]));
      return { name: n, level: 3, years: span.length ? Math.max(1, to - from + 1) : 1, evidence: projects.filter(function (x) { return x.stack.indexOf(n) >= 0; }).map(function (x) { return x.id; }) };
    });
    projects.forEach(function (x) { x.stack.forEach(function (s) { if (!skills.some(function (k) { return k.name === s; })) skills.push({ name: s, level: 3, years: 1, evidence: [x.id] }); }); });
    var links = String(prof.Websites || '').match(/https?:\/\/[^\s,\]]+/g) || [];
    var references = rec.filter(function (r) { return !r.Status || /visible/i.test(r.Status); }).map(function (r) {
      return { name: [r['First Name'], r['Last Name']].join(' ').trim(), relation: [r['Job Title'], r.Company].filter(Boolean).join(', ') + ' (LinkedIn recommendation)', quote: (r.Text || '').replace(/\s+/g, ' ').slice(0, 300), contact: 'on request' };
    }).filter(function (r) { return r.name && r.quote; });
    return { name: [prof['First Name'], prof['Last Name']].join(' ').trim(), headline: prof.Headline || '', summary: (prof.Summary || '').replace(/\s+/g, ' ').trim(), location: place(prof['Geo Location'] || prof.Location),
      links: links.map(function (u) { return { label: /github\.com/.test(u) ? 'GitHub' : 'Website', url: u }; }), skills: skills, projects: projects, experience: experience, references: references,
      sources: [{ type: 'linkedin-export', ref: 'LinkedIn data export', imported: (today || new Date().toISOString()).slice(0, 10) }],
      _found: Object.keys(files).map(function (f) { return f.split('/').pop(); }) };
  }

  // https://jsonresume.org/schema
  function fromJSONResume(r, today) {
    var b = r.basics || {}, nowY = +(today || new Date().toISOString()).slice(0, 4), loc = b.location || {};
    var projects = (r.projects || []).map(function (p) {
      var text = [p.name, p.description].concat(p.highlights || [], p.keywords || []).join('\n');
      return { id: 'jr-' + slugify(p.name), title: p.name || '', year: yearOf(p.endDate) || yearOf(p.startDate) || nowY, role: (p.roles || []).join(', '), summary: p.description || '', outcome: (p.highlights || []).join(' '), stack: uniq((p.keywords || []).map(norm).concat(skillsIn(text))), link: p.url || '', source: 'json-resume' };
    }).filter(function (x) { return x.title; });
    var lv = { master: 5, expert: 5, advanced: 4, intermediate: 3, beginner: 2 };
    var skills = [];
    (r.skills || []).forEach(function (s) { [s.name].concat(s.keywords || []).forEach(function (n) { n = norm(n || ''); if (n && !skills.some(function (k) { return k.name === n; })) skills.push({ name: n, level: lv[String(s.level || '').toLowerCase()] || 3, years: 1, evidence: [] }); }); });
    projects.forEach(function (x) { x.stack.forEach(function (s) { if (!skills.some(function (k) { return k.name === s; })) skills.push({ name: s, level: 3, years: 1, evidence: [] }); }); });
    skills.forEach(function (s) { s.evidence = projects.filter(function (x) { return x.stack.indexOf(s.name) >= 0; }).map(function (x) { return x.id; }); });
    return { name: b.name || '', headline: b.label || '', summary: b.summary || '', location: loc.city ? place(loc.city + (loc.countryCode ? ', ' + loc.countryCode : '')) : null,
      links: (b.url ? [{ label: 'Website', url: b.url }] : []).concat((b.profiles || []).filter(function (p) { return p.url; }).map(function (p) { return { label: p.network || 'Profile', url: p.url }; })),
      skills: skills, projects: projects,
      experience: (r.work || []).map(function (w) { return { org: w.name || w.company || '', title: w.position || '', from: String(yearOf(w.startDate) || ''), to: w.endDate ? String(yearOf(w.endDate) || '') : 'now', summary: [w.summary].concat(w.highlights || []).filter(Boolean).join(' ').slice(0, 280) }; }),
      references: (r.references || []).filter(function (x) { return x.name && x.reference; }).map(function (x) { return { name: x.name, relation: 'Reference', quote: x.reference, contact: 'on request' }; }),
      sources: [{ type: 'json-resume', ref: 'resume.json', imported: (today || new Date().toISOString()).slice(0, 10) }] };
  }

  function toJSONResume(p) {
    var byId = {}; (p.projects || []).forEach(function (x) { byId[x.id] = x; });
    var lv = ['', 'Beginner', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
    return {
      $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
      basics: { name: p.name, label: p.headline, summary: p.summary || '', email: ((p.agent_policy || {}).contact || {}).address || undefined,
        location: { city: (p.location || {}).city, countryCode: (p.location || {}).country || undefined },
        profiles: (p.links || []).map(function (l) { return { network: l.label, url: l.url }; }) },
      work: (p.experience || []).map(function (e) { return { name: e.org, position: e.title, startDate: e.from || undefined, endDate: e.to && e.to !== 'now' ? e.to : undefined, summary: e.summary }; }),
      projects: (p.projects || []).map(function (x) { return { name: x.title, description: x.summary, highlights: x.outcome ? [x.outcome] : [], keywords: x.stack || [], url: x.link || undefined, endDate: x.year ? String(x.year) : undefined, roles: x.role ? [x.role] : [] }; }),
      skills: (p.skills || []).map(function (s) { return { name: s.name, level: lv[s.level] || '', keywords: (s.evidence || []).map(function (e) { return byId[e] ? byId[e].title : null; }).filter(Boolean) }; }),
      references: (p.references || []).map(function (r) { return { name: r.name, reference: r.quote }; }),
      meta: { canonical: p.handle ? undefined : undefined, version: 'v1.0.0', lastModified: p.updated }
    };
  }

  // Fold `part` into `base`: fill what's empty, add what's missing, never overwrite what the person wrote.
  function mergeProfile(base, part) {
    var p = JSON.parse(JSON.stringify(base)), rep = { filled: [], skills: 0, projects: 0, experience: 0, references: 0, links: 0 };
    ['name', 'headline', 'photo', 'summary'].forEach(function (k) { if (!p[k] && part[k]) { p[k] = part[k]; rep.filled.push(k); } });
    if (part.location && part.location.city && !(p.location && p.location.city)) {
      p.location = { city: part.location.city, country: part.location.country || '', utc_offset: part.location.utc_offset != null ? part.location.utc_offset : (p.location || {}).utc_offset || 0 };
      rep.filled.push('location');
    }
    p.links = p.links || []; (part.links || []).forEach(function (l) { if (!p.links.some(function (x) { return x.url.replace(/\/$/, '') === l.url.replace(/\/$/, ''); })) { p.links.push(l); rep.links++; } });
    (part.identities || []).forEach(function (x) { p.identities = p.identities || []; if (!p.identities.some(function (y) { return y.url.replace(/\/$/, '') === x.url.replace(/\/$/, ''); })) p.identities.push(x); });
    p.projects = p.projects || [];
    var idMap = {};
    (part.projects || []).forEach(function (x) {
      var dup = p.projects.filter(function (y) { return (x.link && y.link === x.link) || slugify(y.title) === slugify(x.title); })[0];
      if (dup) { idMap[x.id] = dup.id; dup.stack = uniq((dup.stack || []).concat(x.stack || [])); return; }
      var id = x.id; while (p.projects.some(function (y) { return y.id === id; })) id += '-2';
      idMap[x.id] = id; p.projects.push(Object.assign({}, x, { id: id })); rep.projects++;
    });
    p.skills = p.skills || [];
    (part.skills || []).forEach(function (s) {
      var ev = (s.evidence || []).map(function (e) { return idMap[e] || e; });
      var have = p.skills.filter(function (k) { return norm(k.name) === norm(s.name); })[0];
      if (have) { have.evidence = uniq((have.evidence || []).concat(ev)); have.years = Math.max(have.years || 1, s.years || 1); }
      else { p.skills.push({ name: s.name, level: s.level, years: s.years, evidence: ev }); rep.skills++; }
    });
    // a skill named in a project's stack is proven by it, whichever source either came from
    p.skills.forEach(function (s) { s.evidence = uniq((s.evidence || []).concat(p.projects.filter(function (x) { return (x.stack || []).map(norm).indexOf(norm(s.name)) >= 0; }).map(function (x) { return x.id; }))); });
    p.experience = p.experience || [];
    (part.experience || []).forEach(function (e) { if (!p.experience.some(function (y) { return y.org.toLowerCase() === e.org.toLowerCase() && (!e.title || y.title.toLowerCase() === e.title.toLowerCase()); })) { p.experience.push(e); rep.experience++; } });
    p.references = p.references || [];
    (part.references || []).forEach(function (r) { if (!p.references.some(function (y) { return y.name === r.name; })) { p.references.push(r); rep.references++; } });
    p.sources = (p.sources || []).filter(function (s) { return !(part.sources || []).some(function (n) { return n.type === s.type; }); }).concat(part.sources || []);
    return { profile: p, report: rep };
  }

  return { normalize: normalize, intent: intent, jobOf: jobOf, typeLabel: typeLabel, TYPES: TYPES, intentLines: intentLines, toText: toText, llmsTxt: toText, toJSONResume: toJSONResume, feedbackFor: feedbackFor, digest: digest, setVocab: setVocab, place: place, skillsIn: skillsIn, parseCSV: parseCSV, fromGitHub: fromGitHub, fromLinkedIn: fromLinkedIn, fromJSONResume: fromJSONResume, mergeProfile: mergeProfile, norm: norm, directoryTxt: directoryTxt, summary: summary, match: match, checks: checks, skillFit: skillFit, faqFor: faqFor, parseJD: parseJD, tz: tz, k: k, money: money, fmtDate: fmtDate, STATUS: STATUS, CITY_TZ: CITY_TZ };
})();
if (typeof module !== 'undefined') module.exports = OH;
