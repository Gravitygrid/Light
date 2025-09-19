
(function(){
  const STYLE_ID = 'light-highlights-style';
  const HCLASS = 'light-highlight-mark';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .` + HCLASS + `{
        background: rgba(126,231,135,0.35);
        outline: 1px solid rgba(126,231,135,0.6);
        border-radius: 4px;
        padding: 0 2px;
      }
    `;
    document.documentElement.appendChild(st);
  }

  function clearHighlights(){
    document.querySelectorAll('.' + HCLASS).forEach(node => {
      const parent = node.parentNode;
      if(!parent) return;
      while(node.firstChild){ parent.insertBefore(node.firstChild, node); }
      parent.removeChild(node);
      parent.normalize();
    });
  }

  function walkTextNodes(root, cb){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if(node.parentElement && (/(script|style|noscript|code|pre)/i).test(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while(node = walker.nextNode()){
      cb(node);
    }
  }

  function highlightTerms(terms){
    if(!terms || !terms.length) return 0;
    ensureStyle();
    const uniq = Array.from(new Set(terms.filter(Boolean))).sort((a,b)=>b.length-a.length).slice(0,50);
    const lowerTerms = uniq.map(t => t.toLowerCase());
    let count = 0;

    walkTextNodes(document.body, (textNode) => {
      const text = textNode.nodeValue;
      const lower = text.toLowerCase();
      let idxs = [];
      lowerTerms.forEach(t => {
        let idx = 0;
        while((idx = lower.indexOf(t, idx)) !== -1){
          idxs.push([idx, idx + t.length]);
          idx += t.length;
        }
      });
      if(!idxs.length) return;
      idxs.sort((a,b)=>a[0]-b[0]);
      const merged = [];
      for(const cur of idxs){
        if(!merged.length || cur[0] > merged[merged.length-1][1]) merged.push(cur);
        else merged[merged.length-1][1] = Math.max(merged[merged.length-1][1], cur[1]);
      }
      const frag = document.createDocumentFragment();
      let last = 0;
      merged.forEach(([s,e]) => {
        const before = text.slice(last, s);
        if(before) frag.appendChild(document.createTextNode(before));
        const mark = document.createElement('span');
        mark.className = HCLASS;
        mark.textContent = text.slice(s, e);
        frag.appendChild(mark);
        count++;
        last = e;
      });
      const after = text.slice(last);
      if(after) frag.appendChild(document.createTextNode(after));
      textNode.parentNode.replaceChild(frag, textNode);
    });
    return count;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if(!msg) return;
    if(msg.type === 'GET_PAGE_TEXT'){
      const bodyText = document.body ? document.body.innerText : '';
      sendResponse({ text: bodyText.slice(0,300000), url: location.href });
      return true;
    }
    if(msg.type === 'HIGHLIGHT'){
      clearHighlights();
      const n = highlightTerms(msg.terms || []);
      sendResponse({ ok: true, highlighted: n });
      return true;
    }
    if(msg.type === 'CLEAR_HIGHLIGHT'){
      clearHighlights();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
