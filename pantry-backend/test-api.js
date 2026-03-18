const fs = require('fs');

const sleep = ms => new Promise(res => setTimeout(res, ms));

const testApi = async () => {
  let out = "";
  try {
    const req = await fetch('http://localhost:5000/api/ai/customer-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "What can I make with these?", inventory: [{name: "eggs", quantity: 2}] })
    });
    out += 'Customer Chatbot (Status ' + req.status + '): ' + JSON.stringify(await req.json()) + '\n';
  } catch(e) { out += 'Customer Error: ' + e.message + '\n'; }

  await sleep(35000); // Wait 35s to clear per-minute rate limits

  try {
    const req2 = await fetch('http://localhost:5000/api/ai/b2b-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "What is the return policy?" })
    });
    out += 'Retailer Chatbot (Status ' + req2.status + '): ' + JSON.stringify(await req2.json()) + '\n';
  } catch(e) { out += 'Retailer Error: ' + e.message + '\n'; }

  await sleep(35000); // Wait 35s

  try {
    // We need to login first to get a token
    const loginReq = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Demo User", phone: "8123891404", password: "Password1@", role: "customer" })
    });
    
    const loginReq2 = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: "8123891404", password: "Password1@" }) // Dummy login
    });
    const loginRes = await loginReq2.json();
    let token = loginRes.token || "";

    const req3 = await fetch('http://localhost:5000/api/recipes/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ ingredients: ["eggs", "bread"] })
    });
    out += 'Recipes (Status ' + req3.status + '): ' + JSON.stringify(await req3.json(), null, 2) + '\n';
  } catch(e) { out += 'Recipes/Login Error: ' + e.message + '\n'; }
  
  fs.writeFileSync('test-out.txt', out);
};

testApi();
