const fs = require('fs');
const p = 'src/routes/admin/promos/+page.svelte';
let s = fs.readFileSync(p, 'utf8');
const T = '\t';
const N = '\n';
function once(oldS, neo, label) {
  const n = s.split(oldS).length - 1;
  if (n !== 1) throw new Error(label + ': ditemukan ' + n + ', batal');
  s = s.replace(oldS, neo);
  console.log(label + ': ok');
}

// 1. State sampul (buat + ubah)
once('let formBadge = $state(' + "''" + ');', 'let formBadge = $state(' + "' '" .trim() + ');', 'cek');
