(() => {
  'use strict';
  const cfg = window.ADDAMS_CONFIG || {};
  const functionUrl = name => String(cfg.supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/' + name;
  const configured = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && cfg.turnstileSiteKey);
  const readHash = window.location.hash;
  // Os tokens ficam após #, não são enviados ao servidor da página; removê-los da barra de endereço.
  if (/^#(confirm|unsubscribe)=/.test(readHash)) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  const status = (target, message, error=false) => {
    if (!target) return;
    target.textContent = message;
    target.className = error ? 'form-feedback error club-feedback' : 'form-feedback success club-feedback';
  };
  async function call(name, body) {
    const res = await fetch(functionUrl(name), {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
      cache:'no-store'
    });
    const answer = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(answer.error || 'Serviço temporariamente indisponível.');
    return answer;
  }
  async function handleActionLink() {
    const output = document.getElementById('club-link-status');
    if (!output) return;
    const match = /^#(confirm|unsubscribe)=([0-9a-f-]{36}\.[0-9a-f]{64})$/i.exec(readHash);
    if (!match) {
      if (readHash.startsWith('#confirm=') || readHash.startsWith('#unsubscribe=')) {
        status(output, 'Este link não parece válido. Solicite uma nova mensagem.',true);
      }
      return;
    }
    status(output, match[1]==='confirm' ? 'Confirmando sua entrada no clube…' : 'Registrando seu cancelamento…');
    try {
      const r = await call('club-action', {action:match[1],token:match[2]});
      status(output,r.message || 'Solicitação concluída.');
    } catch(e) {status(output,e.message || 'Não foi possível concluir sua solicitação.',true);}
  }
  async function mountCaptcha(form) {
    const field = form.querySelector('[data-club-turnstile]');
    if (!field || !configured) return null;
    if (!window.turnstile) {
      await new Promise((resolve,reject)=>{
        let script = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
        if (!script) {
          script=document.createElement('script');
          script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async=true;script.defer=true;
          document.head.append(script);
        }
        if (window.turnstile) {resolve(null);return;}
        script.addEventListener('load',()=>resolve(null),{once:true});
        script.addEventListener('error',()=>reject(new Error('Não foi possível carregar a verificação.')),{once:true});
      });
    }
    return window.turnstile.render(field, {sitekey:cfg.turnstileSiteKey});
  }
  function initForm(form) {
    const output=form.querySelector('[data-club-feedback]');
    const submit=form.querySelector('button[type="submit"]');
    if (!configured) {
      if (submit) submit.disabled=true;
      status(output,'As inscrições estão sendo preparadas. Volte em breve.');
      return;
    }
    let captchaId=null;
    mountCaptcha(form).then(id=>{captchaId=id;}).catch(()=>status(output,'Não foi possível carregar a verificação de segurança.',true));
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if (!form.reportValidity() || !submit || submit.disabled) return;
      if (captchaId===null || !window.turnstile) {status(output,'Conclua a verificação de segurança.',true);return;}
      const turnstileToken=window.turnstile.getResponse(captchaId);
      if (!turnstileToken) {status(output,'Conclua a verificação de segurança.',true);return;}
      const action=form.dataset.clubAction || 'subscribe';
      const values=new FormData(form);
      const payload={
        action,
        email:String(values.get('email')||'').trim(),
        pseudonym:String(values.get('pseudonym')||'').trim(),
        website:String(values.get('website')||''),
        consent:action!=='subscribe' || values.get('consent')==='yes',
        turnstileToken
      };
      if (action==='subscribe' && payload.consent!==true) {
        status(output,'Marque o consentimento para receber as novidades.',true);return;
      }
      submit.disabled=true;
      status(output,'Preparando sua correspondência…');
      try {
        const response=await call('club-request',payload);
        status(output,response.message || 'Se o endereço for válido, enviaremos instruções.');
        form.reset();
      } catch(err) {
        status(output,err.message || 'Não foi possível processar o pedido.',true);
      } finally {
        submit.disabled=false;
        window.turnstile.reset(captchaId);
      }
    });
  }
  document.querySelectorAll('[data-club-form]').forEach(initForm);
  handleActionLink();
})();