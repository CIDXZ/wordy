'use strict';

/* ---------------------------------------------------------------------------
   The set. `cues` are only used by the offline tutor; the model never sees them.
--------------------------------------------------------------------------- */
const WORDS = [
  {w:'mitigate', pos:'verb', ipa:'/ˈmɪtɪɡeɪt/',
   def:'to make something less severe or less harmful',
   ex:'We added a second reviewer to mitigate the risk of bad data going out.',
   ex2:"Backups don't prevent an outage, they mitigate the damage.",
   syn:['alleviate','reduce','lessen','ease'],
   cues:['reduce','less','risk','lower','soften','limit','ease','prevent','minimis','minimiz','damage','harm','impact','cushion','protect']},
  {w:'escalate', pos:'verb', ipa:'/ˈɛskəleɪt/',
   def:'to pass a problem to someone more senior, or to make it more intense',
   ex:'If the customer is still stuck after two replies, escalate it to the lead.',
   ex2:'The argument escalated once the deadline was missed.',
   syn:['refer up','raise','intensify','step up'],
   cues:['senior','manager','lead','raise','higher','above','urgent','report','boss','supervis','next level','worse','grew','bigger','heated']},
  {w:'redundant', pos:'adjective', ipa:'/rɪˈdʌndənt/',
   def:'no longer needed, because it repeats something that already exists',
   ex:'Half the checks in that script are redundant, the API already validates the input.',
   ex2:'Once the new dashboard shipped, the weekly email report became redundant.',
   syn:['unnecessary','superfluous','surplus','duplicate'],
   cues:['repeat','duplicate','same','already','extra','unnecessary','not needed','useless','twice','spare','pointless','no longer','replaced']},
  {w:'ambiguous', pos:'adjective', ipa:'/æmˈbɪɡjuəs/',
   def:'open to more than one meaning, unclear',
   ex:'The requirement was ambiguous, so two teams built two different things.',
   ex2:"Her reply was ambiguous, I couldn't tell if it was a yes.",
   syn:['unclear','vague','equivocal','open to interpretation'],
   cues:['unclear','confus','two mean','more than one','vague','not clear','doubt','interpret','uncertain','both ways',"couldn't tell",'could not tell','different things']},
  {w:'leverage', pos:'verb', ipa:'/ˈliːvərɪdʒ/',
   def:'to use something you already have to get a bigger result',
   ex:'We leveraged the existing customer list instead of buying ads.',
   ex2:'She leveraged her sales background to move into product.',
   syn:['capitalise on','make use of','exploit','build on'],
   cues:['use','using','existing','advantage','benefit','already','resource','apply','strength','build on','background','experience','network']},
  {w:'bottleneck', pos:'noun', ipa:'/ˈbɒtlnɛk/',
   def:'the one slow point that holds up everything behind it',
   ex:'Approvals were the bottleneck, every request waited two days there.',
   ex2:'With one reviewer for the whole team, code review became the bottleneck.',
   syn:['hold-up','choke point','constraint','obstruction'],
   cues:['slow','delay','stuck','wait','hold','block','queue','backlog','jam','pile','choke','only one','one person','behind']},
  {w:'iterate', pos:'verb', ipa:'/ˈɪtəreɪt/',
   def:'to improve something by repeating it in small rounds',
   ex:'We iterated on the form four times before the drop-off stopped.',
   ex2:'Ship a rough version first, then iterate based on what users do.',
   syn:['refine','rework','revise','repeat'],
   cues:['repeat','again','improve','version','round','refine','revise','loop','small change','test','draft','feedback','better','each time','every week']},
  {w:'discrepancy', pos:'noun', ipa:'/dɪˈskrɛpənsi/',
   def:'a difference between two things that should match',
   ex:'There was a discrepancy between the dashboard and the raw export.',
   ex2:'Finance flagged a discrepancy of four thousand rupees in the monthly totals.',
   syn:['mismatch','inconsistency','difference','variance'],
   cues:['differ','mismatch','match','gap','inconsist','number','wrong','conflict','off by','disagree','tally','between','total','report']},
  {w:'prudent', pos:'adjective', ipa:'/ˈpruːdnt/',
   def:'sensible and careful, especially about risk',
   ex:'It was prudent to keep three months of savings before switching jobs.',
   ex2:'It would be prudent to test the change on a small group first.',
   syn:['sensible','cautious','wise','careful'],
   cues:['careful','wise','sensible','safe','cautious','sensib','avoid','think ahead','plan','risk','just in case','first','before','save','saving','backup']},
  {w:'consolidate', pos:'verb', ipa:'/kənˈsɒlɪdeɪt/',
   def:'to combine several things into one stronger whole',
   ex:'We consolidated six spreadsheets into a single tracker.',
   ex2:'The company consolidated its three offices into one building.',
   syn:['combine','merge','unify','bring together'],
   cues:['combine','merge','together','into one','single','unify','join','gather','bring','central','tidy','one place','one building','one tracker']}
];

const VERDICTS = new Set(['correct','wrong_sense','missing_word','not_sentence','chat','skip']);
const VERDICT_LABEL = {correct:'correct', wrong_sense:'wrong sense', missing_word:'word missing',
                       not_sentence:'needs a sentence', skip:'parked'};
const DEFAULT_HINT = 'Ask “what does it mean?”, say “next” to skip, or “practise” and a word to go back to it.';

const $ = id => document.getElementById(id);
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = {
  running:false, awaiting:false, busy:false, listening:false, micBlocked:!SR,
  queue:[], current:null, presented:0, attempts:0, learned:0,
  history:[], tutor:null, modelName:'', modelRetryAt:0,
  speechId:0, heardFinal:'', heardInterim:'', handsFree:true, tab:'practice'
};
try { const v = localStorage.getItem('wordy.handsFree'); if (v !== null) S.handsFree = v === '1'; } catch (e) {}

/* ---------------------------------------------------------------------------
   Small DOM helper
--------------------------------------------------------------------------- */
function h(tag, attrs, ...kids){
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)){
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()){
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : String(k));
  }
  return e;
}
const SPEAKER_D = 'M3 9v6h4l5 5V4L7 9zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77';
function icon(d, size){
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
  s.appendChild(p);
  return s;
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const listJoin = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------------------------------------------------------------------------
   Speech out
--------------------------------------------------------------------------- */
let voice = null;
function pickVoice(){
  if (!synth) return;
  const vs = synth.getVoices();
  if (!vs.length) return;
  const nat = v => /natural|online|google/i.test(v.name);
  // UK English first: Edge's "Sonia/Libby/Ryan (Natural)", Chrome's "Google UK English", then any UK voice
  const order = [
    v => /^en-GB/i.test(v.lang) && nat(v), v => /^en-GB/i.test(v.lang),
    v => /^en-IN/i.test(v.lang) && nat(v), v => /^en-US/i.test(v.lang) && nat(v),
    v => /^en/i.test(v.lang)
  ];
  for (const f of order){ const hit = vs.find(f); if (hit){ voice = hit; return; } }
}
if (synth){ pickVoice(); synth.addEventListener && synth.addEventListener('voiceschanged', pickVoice); }

/* Resolves true if the whole text was spoken, false if something cut it off.
   Long text is split by sentence because Chrome silently stops utterances after about 15 seconds. */
function speak(text){
  return new Promise(resolve => {
    if (!synth){ resolve(true); return; }
    const id = ++S.speechId;
    synth.cancel();
    const parts = (text.match(/[^.!?]+[.!?]+["'”)]*|[^.!?]+$/g) || [text]).map(s => s.trim()).filter(Boolean);
    let i = 0, ended = false;
    document.body.classList.add('speaking');
    const finish = ok => {
      if (ended) return; ended = true;
      if (id === S.speechId) document.body.classList.remove('speaking');
      resolve(ok);
    };
    const step = () => {
      if (id !== S.speechId){ finish(false); return; }
      if (i >= parts.length){ finish(true); return; }
      const u = new SpeechSynthesisUtterance(parts[i++]);
      if (voice){ u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
      u.rate = 1;
      let settled = false;
      const go = () => { if (settled) return; settled = true; clearTimeout(guard); step(); };
      const guard = setTimeout(go, 2500 + u.text.length * 110);   // some browsers never fire onend
      u.onend = go;
      u.onerror = ev => {
        if (ev.error === 'interrupted' || ev.error === 'canceled'){ settled = true; clearTimeout(guard); finish(false); }
        else go();
      };
      synth.speak(u);
    };
    step();
  });
}
function hush(){
  S.speechId++;
  if (synth) synth.cancel();
  document.body.classList.remove('speaking');
}

/* ---------------------------------------------------------------------------
   Speech in
--------------------------------------------------------------------------- */
let rec = null;
if (SR){
  rec = new SR();
  rec.lang = 'en-IN';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = e => {
    let fin = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++){
      const r = e.results[i];
      if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript;
    }
    if (fin) S.heardFinal += fin;
    S.heardInterim = interim;
    $('input').value = (S.heardFinal + ' ' + interim).trim();
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      S.micBlocked = true;
      applyMic();
      setHint('The microphone is blocked, so type your answers instead.');
    } else if (e.error === 'no-speech'){
      setHint('Nothing came through. Tap the mic when you are ready.');
    } else if (e.error === 'network'){
      setHint('Speech recognition needs a connection. Typing still works.');
    }
  };
  rec.onend = () => {
    const said = (S.heardFinal || S.heardInterim).trim();
    S.heardFinal = ''; S.heardInterim = '';
    S.listening = false;
    $('input').value = '';
    syncUI();
    if (said) handleUser(said, 'said');
  };
}
function startListening(){
  if (!rec || S.listening || S.micBlocked || S.busy) return;
  hush();
  S.heardFinal = ''; S.heardInterim = '';
  try { rec.start(); S.listening = true; setHint(DEFAULT_HINT); } catch (e) { S.listening = false; }
  syncUI();
}
function stopListening(){ if (rec && S.listening){ try { rec.stop(); } catch (e) {} } }
function autoListen(){
  if (S.handsFree && !S.micBlocked && S.running && S.awaiting && !S.busy && S.tab === 'practice') startListening();
}

/* ---------------------------------------------------------------------------
   Conversation thread
--------------------------------------------------------------------------- */
function scrollDown(){
  if (S.tab !== 'practice') return;
  requestAnimationFrame(() => window.scrollTo({top:document.documentElement.scrollHeight, behavior:reduceMotion ? 'auto' : 'smooth'}));
}
function addTurn(who, text, opts = {}){
  const head = h('div', {class:'who'});
  if (who === 'agent'){
    head.append(h('span', null, 'Wordy'));
    if (opts.verdict && VERDICT_LABEL[opts.verdict]) head.append(h('span', {class:'verdict v-' + opts.verdict}, VERDICT_LABEL[opts.verdict]));
  } else {
    head.append(h('span', null, opts.how === 'said' ? 'You said' : 'You typed'));
  }
  const t = h('div', {class:'turn ' + who}, head, h('p', {class:'say'}, text), opts.extra || null);
  $('thread').appendChild(t);
  scrollDown();
  return t;
}
function remember(role, text){
  S.history.push({role, text});
  if (S.history.length > 16) S.history.splice(0, S.history.length - 16);
}
function agentSay(text, verdict, extra){
  addTurn('agent', text, {verdict, extra});
  remember('agent', text);
  return speak(text);
}
function thinking(on){
  const old = $('thinking');
  if (old) old.remove();
  if (!on) return;
  $('thread').appendChild(h('div', {class:'turn agent', id:'thinking', 'aria-label':'Wordy is thinking'},
    h('div', {class:'who'}, h('span', null, 'Wordy')),
    h('div', {class:'dots'}, h('i'), h('i'), h('i'), h('i'))));
  scrollDown();
}
function beginRow(label){
  return h('div', {class:'begin-row'}, h('button', {class:'gbtn primary', type:'button', onclick:start}, label));
}

/* ---------------------------------------------------------------------------
   Panel, stats, ticks, the set
--------------------------------------------------------------------------- */
function setQuery(word, note){
  const q = $('query');
  q.replaceChildren();
  if (!word){ q.append(h('span', {class:'ph'}, note || 'ten words for work')); return; }
  if (note) q.append(h('span', {class:'n'}, note));
  q.append(word);
}
function renderPanelRest(){
  $('kpBody').replaceChildren(
    h('div', {class:'kp-sec'},
      h('h2', {class:'kp-title'}, 'Wordy'),
      h('p', {class:'kp-sub'}, 'Voice vocabulary tutor')),
    h('div', {class:'kp-sec'},
      h('p', {class:'kp-desc'}, 'Teaches one word at a time, then listens while you use it in a sentence of your own and tells you how it landed.')),
    h('div', {class:'kp-sec'},
      h('div', {class:'facts'},
        h('p', {class:'fact'}, h('b', null, 'Words: '), '10, picked from interviews and everyday work'),
        h('p', {class:'fact'}, h('b', null, 'Checks: '), 'the word was said, it sits in a full sentence, the sense is right'),
        h('p', {class:'fact'}, h('b', null, 'Retries: '), 'one on the spot, then the word comes back at the end'),
        h('p', {class:'fact'}, h('b', null, 'Revisit: '), 'say “practise” and the word, or tap it in The set'),
        h('p', {class:'fact'}, h('b', null, 'Voice: '), 'Chrome and Edge. Typing works everywhere'))));
}
function renderPanelWord(c){
  $('kpBody').replaceChildren(
    h('div', {class:'kp-sec'},
      h('h2', {class:'kp-title'}, c.w),
      h('p', {class:'kp-sub'},
        h('span', null, c.ipa),
        h('button', {class:'iconbtn sm', type:'button', 'aria-label':'Hear ' + c.w, onclick:() => speak(c.w)}, icon(SPEAKER_D, 18)))),
    h('div', {class:'kp-sec'},
      h('p', {class:'pos'}, c.pos),
      h('ol', {class:'defs'}, h('li', null, h('span', null, c.def), h('p', {class:'ex'}, '“' + c.ex + '”'))),
      h('div', {class:'similar'}, h('span', {class:'lbl'}, 'Similar:'), c.syn.map(s => h('span', {class:'chip'}, s)))));
}
function renderPanelDone(){
  const owed = WORDS.filter(w => !w.cleared).map(w => w.w);
  $('kpBody').replaceChildren(
    h('div', {class:'kp-sec'},
      h('h2', {class:'kp-title'}, 'Set complete'),
      h('p', {class:'kp-sub'}, S.learned + ' of ' + WORDS.length + ' cleared')),
    h('div', {class:'kp-sec'},
      h('div', {class:'facts'},
        h('p', {class:'fact'}, h('b', null, 'Attempts: '), String(S.attempts)),
        h('p', {class:'fact'}, h('b', null, 'Still to work on: '), owed.length ? owed.join(', ') : 'nothing, every word cleared'))));
}
function renderTicks(){
  const t = $('ticks');
  if (!t.children.length) WORDS.forEach(() => t.appendChild(document.createElement('i')));
  [...t.children].forEach((tick, i) => {
    const w = WORDS[i];
    tick.className = w.cleared ? 'on' : (S.current === w ? 'cur' : (w.repeat ? 'due' : ''));
  });
}
function renderStats(){
  const parts = [];
  if (!S.running && !S.attempts){
    parts.push(WORDS.length + ' words in this set', 'none attempted yet');
  } else {
    if (S.current) parts.push(S.current.revisit ? 'Revisiting ' + S.current.w
      : S.current.repeat ? 'Second look' : 'Word ' + S.presented + ' of ' + WORDS.length);
    parts.push(S.learned + ' cleared', S.attempts + (S.attempts === 1 ? ' attempt' : ' attempts'));
  }
  if (S.tutor === 'model') parts.push('tutor: ' + (S.modelName || 'language model'));
  else if (S.tutor === 'rules') parts.push('tutor: offline rules');
  $('stats').textContent = parts.join(' · ');
  renderTicks();
  if (S.tab === 'set') renderSet();
}
function renderSet(){
  $('view-set').replaceChildren(
    h('p', {class:'set-note'}, 'Tap a word to practise it now. The speaker just reads it out.'),
    ...WORDS.map(w => {
      const state = w.cleared ? 'cleared' : (w.repeat ? 'due' : '');
      const now = S.running && S.current === w;
      return h('div', {class:'res' + (state ? ' ' + state : '')},
        h('p', {class:'crumb'}, 'wordy › set › ' + w.pos + ' › ' + w.ipa),
        h('div', {class:'rline'},
          h('button', {class:'rtitle', type:'button', title:'Practise ' + w.w, onclick:() => practiseWord(w)}, w.w),
          h('button', {class:'iconbtn sm', type:'button', 'aria-label':'Hear ' + w.w,
                       onclick:() => speak(w.w + '. ' + w.def + '. ' + w.ex)}, icon(SPEAKER_D, 18)),
          now ? h('span', {class:'rmark now'}, 'practising now')
              : state ? h('span', {class:'rmark'}, state === 'cleared' ? 'cleared' : 'coming back') : null),
        h('p', {class:'rsnip'}, w.def));
    }));
}

/* ---------------------------------------------------------------------------
   UI state
--------------------------------------------------------------------------- */
function setHint(text){ $('hint').textContent = text; }
function applyMic(){
  $('mic').hidden = S.micBlocked;
  $('hf').disabled = S.micBlocked;
  if (S.micBlocked){ $('hf').checked = false; setHint('Voice input needs Chrome or Edge. Type your answers here.'); }
}
function syncUI(){
  const locked = S.busy || (S.running && !S.awaiting);
  const input = $('input');
  input.disabled = locked && !S.listening;
  input.placeholder = S.listening ? 'Listening…'
    : (!S.running ? 'Say or type “begin”' : (locked ? '' : 'Say or type your sentence'));
  $('send').disabled = input.disabled || S.listening || !input.value.trim();
  $('mic').disabled = S.micBlocked || (locked && !S.listening);
  $('mic').classList.toggle('live', S.listening);
  $('mic').setAttribute('aria-label', S.listening ? 'Stop listening' : 'Answer by voice');
  $('pill').classList.toggle('live', S.listening);
  $('hear').disabled = !S.current;
}
function showTab(name){
  S.tab = name;
  ['practice', 'set', 'about'].forEach(n => {
    $('view-' + n).hidden = n !== name;
    $('tab-' + n).classList.toggle('sel', n === name);
    $('tab-' + n).setAttribute('aria-selected', String(n === name));
  });
  $('composer').hidden = name !== 'practice';
  $('side').hidden = name !== 'practice';
  document.body.classList.toggle('has-composer', name === 'practice');
  if (name === 'set') renderSet();
  if (name !== 'practice') stopListening();
  window.scrollTo(0, name === 'practice' ? document.documentElement.scrollHeight : 0);
}

/* ---------------------------------------------------------------------------
   Tutors
--------------------------------------------------------------------------- */
function saidWord(text, c){
  const stem = c.w.replace(/e$/, '');
  return text.toLowerCase().includes(stem.slice(0, Math.max(4, stem.length - 2)));
}

async function askModel(text, c, finalTry){
  if (Date.now() < S.modelRetryAt) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:ctrl.signal,
      body:JSON.stringify({
        text, finalTry, secondLook:!!c.repeat,
        word:{w:c.w, pos:c.pos, def:c.def, ex:c.ex, ex2:c.ex2, syn:c.syn},
        history:S.history.slice(-11, -1)
      })
    });
    if (!r.ok) throw new Error('status ' + r.status);
    const j = await r.json();
    if (!j || typeof j.reply !== 'string' || !j.reply.trim()) throw new Error('empty reply');
    S.tutor = 'model';
    S.modelName = typeof j.model === 'string' ? j.model : '';
    return {reply:j.reply.trim().slice(0, 600), verdict:VERDICTS.has(j.verdict) ? j.verdict : 'chat'};
  } catch (e) {
    S.tutor = 'rules';
    S.modelRetryAt = Date.now() + 60000;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function offlineTutor(text, c, finalTry){
  const s = text.toLowerCase().trim();
  const words = s.split(/\s+/).filter(Boolean);
  const has = saidWord(s, c);
  // "what does mitigate mean?" contains the word but is a question, not an attempt
  const asking = /\?\s*$/.test(s) ||
    /^(what|how|can|could|give|tell|say|repeat|another|example|next|skip|pass|i don'?t|no idea|not sure|help)\b/.test(s);

  if ((!has || asking) && words.length <= 8){
    if (/\b(next|skip|pass|move on)\b/.test(s))
      return {verdict:'skip', reply:c.repeat ? 'Okay, leaving ' + c.w + ' there for now.' : 'Okay, parking ' + c.w + '. It comes back at the end.'};
    if (/\b(don'?t know|no idea|not sure|help|stuck)\b/.test(s))
      return {verdict:'chat', reply:'No problem. Here is one more to borrow from. ' + c.ex2 + ' Now try your own.'};
    if (/\b(example|another)\b/.test(s))
      return {verdict:'chat', reply:'Sure. ' + c.ex2 + ' Your turn.'};
    if (/\b(repeat|again|pardon|sorry)\b/.test(s))
      return {verdict:'chat', reply:c.w + '. It means ' + c.def + '. Use it in a sentence.'};
    if (/\b(mean|meaning|define|understand|what)\b/.test(s))
      return {verdict:'chat', reply:cap(c.w) + ' means ' + c.def + '. Close to ' + c.syn.slice(0, 2).join(' or ') + '. Try a sentence with it.'};
  }
  if (!has){
    return finalTry
      ? {verdict:'missing_word', reply:'I still did not hear ' + c.w + ' in that. We will come back to it.'}
      : {verdict:'missing_word', reply:'That sentence does not have ' + c.w + ' in it. Try again, and make sure the word is in there.'};
  }
  if (words.length < 5)
    return {verdict:'not_sentence', reply:'That is the word. Now put it in a full sentence, something you would actually say at work.'};
  if (c.cues.some(k => s.includes(k)))
    return {verdict:'correct', reply:pick(['Nice, that is ' + c.w + ' used properly.', 'Yes, that works. Good use of ' + c.w + '.', 'That is right, ' + c.w + ' fits there.'])};
  return finalTry
    ? {verdict:'wrong_sense', reply:'Close, but the meaning is still off. ' + cap(c.w) + ' means ' + c.def + '. We will come back to it.'}
    : {verdict:'wrong_sense', reply:'The sentence is fine, but ' + c.w + ' does not quite fit there. It means ' + c.def + '. Try once more.'};
}

/* ---------------------------------------------------------------------------
   Lesson flow. The page owns progress; tutors only supply a reply and a verdict.
--------------------------------------------------------------------------- */
function start(first){
  hush(); stopListening();
  document.querySelectorAll('.begin-row').forEach(n => n.remove());
  WORDS.forEach(w => { w.cleared = false; w.repeat = false; w.tries = 0; w.seen = false; w.revisit = false; w.resume = false; });
  S.queue = shuffle(WORDS.slice());
  if (first && first.w) S.queue = [first, ...S.queue.filter(x => x !== first)];
  S.running = true; S.mode = 'full'; S.presented = 0; S.attempts = 0; S.learned = 0; S.current = null;
  if (S.tab !== 'practice') showTab('practice');
  presentNext(true);
}

async function presentNext(first){
  if (!S.queue.length){ finish(); return; }
  const c = S.queue.shift();
  S.current = c; c.tries = 0;
  if (!c.seen){ c.seen = true; S.presented++; }
  S.lastWord = c.w;
  renderPanelWord(c);
  setQuery(c.w, c.revisit ? 'revisit' : c.resume ? 'back to' : c.repeat ? 'second look' : S.presented + ' / ' + WORDS.length);
  renderStats();
  S.awaiting = true; syncUI();
  const line = c.revisit
    ? "Let's go back to " + c.w + '. It means ' + c.def + '. Here is how it is used. ' + c.ex +
      ' Give me a new sentence with ' + c.w + '.'
    : c.resume
    ? 'Back to ' + c.w + ', where we left off. It means ' + c.def + '. Give me a sentence with it.'
    : c.repeat
    ? 'Back to ' + c.w + '. It means ' + c.def + '. Have another go, use it in a sentence.'
    : (first ? 'First word, ' : 'Next word, ') + c.w + '. It means ' + c.def + '. Here is how it is used. ' + c.ex +
      ' Now you try. Say a sentence with ' + c.w + ' in it.';
  c.resume = false;
  if (await agentSay(line)) autoListen();
}

/* Going back to a word, from a spoken request or from The set. The word in progress steps aside without penalty
   and comes straight back after. After the set is finished this runs a one-word session. */
const PRACTISE_RE = new RegExp(
  "^(?:(?:can|could|shall) (?:we|i) |let's |lets |let me |i (?:want|wanna|would like) to |i'd like to |please )?" +
  "(?:practi[sc]e|revisit|redo|review|do|try|switch to|go back to|back to|(?:have )?(?:another )?go at)\\s+" +
  "(?:the word\\s+)?([a-z-]+)(?:\\s+(?:again|once more|please))*\\s*[.?!]*$");
const AGAIN_RE = /^([a-z-]+)\s+again\s*[.?!]*$/;

function parsePractise(text){
  const s = text.trim().toLowerCase().replace(/[‘’]/g, "'");
  const m = s.match(PRACTISE_RE) || s.match(AGAIN_RE);
  if (!m || m[1].length < 4) return null;
  return WORDS.find(w => saidWord(m[1], w)) || null;
}

function practiseWord(entry){
  if (S.tab !== 'practice') showTab('practice');
  const t0 = Date.now();
  const go = () => {
    // wait out a reply that is being fetched or a word change that is already under way
    if (S.busy || (S.running && !S.awaiting)){ if (Date.now() - t0 < 15000) setTimeout(go, 200); return; }
    switchTo(entry);
  };
  go();
}

async function switchTo(entry){
  hush(); stopListening();
  if (S.running && S.current === entry){
    if (await agentSay('We are on ' + entry.w + ' right now. Give me a sentence with it.')) autoListen();
    return;
  }
  if (!S.running && !WORDS.some(w => w.seen)){ start(entry); return; }

  entry.revisit = !!entry.seen;
  S.queue = S.queue.filter(x => x !== entry);
  if (S.running){
    if (S.current){ S.current.resume = true; S.queue.unshift(S.current); }
  } else {
    S.running = true; S.mode = 'mini';
    document.querySelectorAll('.begin-row').forEach(n => n.remove());
  }
  S.queue.unshift(entry);
  S.current = null;
  presentNext(false);
}

async function handleUser(raw, how){
  const text = raw.trim();
  if (!text || S.busy) return;
  hush();
  $('input').value = '';
  addTurn('user', text, {how});
  remember('user', text);

  const wanted = parsePractise(text);
  if (wanted){ syncUI(); practiseWord(wanted); return; }

  if (!S.running){
    if (/\b(begin|start|go|ready|yes|again|ok|okay)\b/i.test(text)) start();
    else agentSay('Whenever you are ready, say begin or press the Begin button.');
    syncUI();
    return;
  }
  if (!S.awaiting) return;

  const c = S.current;
  const finalTry = c.tries >= 1;
  S.busy = true; S.awaiting = false; syncUI();
  thinking(true);
  let res = await askModel(text, c, finalTry);
  if (!res) res = offlineTutor(text, c, finalTry);
  thinking(false);
  S.busy = false;
  await applyResult(res, c, finalTry);
}

function requeue(c){
  // a word the learner asked for by name doesn't get sent round again
  if (!c.repeat && !c.revisit){ c.repeat = true; S.queue.push(c); }
}

async function applyResult(res, c, finalTry){
  const v = res.verdict;
  let advance = false;
  if (v === 'correct'){
    S.attempts++;
    if (!c.cleared){ c.cleared = true; S.learned++; }
    advance = true;
  } else if (v === 'wrong_sense' || v === 'missing_word'){
    S.attempts++; c.tries++;
    if (finalTry){ requeue(c); advance = true; }
  } else if (v === 'skip'){
    requeue(c); advance = true;
  }
  renderStats();

  if (advance){
    c.revisit = false;
    S.awaiting = false; syncUI();
    await agentSay(res.reply, v);
    presentNext(false);
  } else {
    S.awaiting = true; syncUI();
    if (await agentSay(res.reply, v)) autoListen();
  }
}

async function finish(){
  S.running = false; S.awaiting = false; S.current = null;
  renderPanelDone();
  setQuery(null, 'set complete');
  renderStats(); syncUI();
  const owed = WORDS.filter(w => !w.cleared).map(w => w.w);
  if (S.mode === 'mini'){
    await agentSay(cap(S.lastWord) + ', done. ' + S.learned + ' of ' + WORDS.length + ' cleared overall. ' +
      'Say practise and another word, pick one from The set, or say begin to run the whole set again.',
      null, beginRow('Run the whole set'));
    return;
  }
  const line = 'That is the whole set. You cleared ' + S.learned + ' of ' + WORDS.length + ' in ' + S.attempts +
    (S.attempts === 1 ? ' attempt.' : ' attempts.') +
    (owed.length ? ' Still worth another look, ' + listJoin(owed) + '.' : ' Every word cleared.') +
    ' Say begin to run it again in a new order.';
  await agentSay(line, null, beginRow('Run it again'));
}

/* ---------------------------------------------------------------------------
   Wiring
--------------------------------------------------------------------------- */
$('pill').addEventListener('submit', e => {
  e.preventDefault();
  if (S.listening) return;
  handleUser($('input').value, 'typed');
});
$('input').addEventListener('input', syncUI);
$('mic').addEventListener('click', () => { if (S.listening) stopListening(); else startListening(); });
$('hear').addEventListener('click', () => { if (S.current) speak(S.current.w + '. ' + S.current.def); });
$('hf').checked = S.handsFree && !S.micBlocked;
$('hf').addEventListener('change', () => {
  S.handsFree = $('hf').checked;
  try { localStorage.setItem('wordy.handsFree', S.handsFree ? '1' : '0'); } catch (e) {}
  if (S.handsFree) autoListen(); else stopListening();
});
['practice', 'set', 'about'].forEach(n => $('tab-' + n).addEventListener('click', () => showTab(n)));
document.addEventListener('visibilitychange', () => { if (document.hidden) stopListening(); });

applyMic();
if (!S.micBlocked) setHint(DEFAULT_HINT);
renderPanelRest();
renderStats();
addTurn('agent',
  "Hi, I'm Wordy. I'll teach you ten words that come up at work and in interviews, one at a time. " +
  'For each one I explain it, you use it in a sentence out loud, and I tell you how it landed. ' +
  'You can cut in any time to ask what a word means, ask for another example, or say next to skip.',
  {extra:beginRow('Begin')});
syncUI();
