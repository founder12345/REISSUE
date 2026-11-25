import { createServer } from 'node:http';
const messages=new Map();
createServer(async (req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method==='POST'&&url.pathname==='/emails'){
    try{
      let data='';
      for await(const chunk of req){data+=chunk;if(data.length>150_000)throw Error('Mail fixture too large');}
      const message=JSON.parse(data), email=message.to?.[0];
      if(typeof email!=='string'||!email.endsWith('@example.test'))throw Error('Only isolated test recipients are permitted');
      messages.set(email+':'+(message.subject.includes('Reset')?'reset':message.subject.includes('Verify')?'verify':'notice'),message);
      res.writeHead(200,{'Content-Type':'application/json'}).end('{"id":"captured"}');
    }catch{res.writeHead(400).end();}
    return;
  }
  if(url.pathname==='/message'){
    const message=messages.get(url.searchParams.get('email')+':'+url.searchParams.get('purpose'));
    res.writeHead(message?200:404,{'Content-Type':'application/json'}).end(JSON.stringify(message??null));return;
  }
  res.writeHead(200).end('ready');
}).listen(3219,'127.0.0.1');
