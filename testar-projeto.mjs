import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
for (const path of ['docs/index.html','docs/capitulo.html','docs/painel/index.html','docs/assets/style.css','docs/assets/config.js','supabase/functions/contact/index.ts','supabase/functions/reply/index.ts','supabase/functions/delete-letter/index.ts','db/schema.sql']) {
 assert.ok(existsSync(path), `${path} ausente`);
}
const publicJs=readFileSync('docs/assets/site.js','utf8');
const adminJs=readFileSync('docs/assets/admin.js','utf8');
assert.ok(publicJs.includes("functionUrl('contact')"));
assert.ok(adminJs.includes("functionUrl('reply')") && adminJs.includes("functionUrl('delete-letter')"));
assert.ok(!publicJs.includes('/.netlify/functions/') && !adminJs.includes('/.netlify/functions/'));
assert.ok(readFileSync('docs/painel/index.html','utf8').includes('id="dashboard" class="dashboard hidden"'));
assert.ok(readFileSync('docs/index.html','utf8').includes('Todos os direitos reservados'));
console.log('OK - Estrutura para GitHub Pages validada. Serviços externos dependem de configuração e testes reais.');
