import fetch from "node-fetch";

fetch("http://localhost:3000/api/health")
  .then(r => Array.from(r.headers.entries()).map(([k,v]) => console.log(k, v)) && r.text())
  .then(console.log)
  .catch(console.error);
