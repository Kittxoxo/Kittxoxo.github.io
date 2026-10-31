# Human Bingo (Vercel)
Flow: enter name -> bingo card -> final card (time's up) -> winners showcase (host controlled) -> host Reset -> back to enter name.
- public/index.html -> the game page (players + host)
- api/*.js          -> serverless functions
Env var you add yourself: ADMIN_PASSWORD. Database: Upstash Redis (Vercel Storage); its variables are added automatically.
Host: Host login -> Open live board / Start winners showcase.
