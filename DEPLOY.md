# Deploy automático: Lovable → GitHub → Vercel

O objetivo é que, sempre que você publicar no Lovable, o Vercel receba o mesmo
código e faça o build automaticamente — mantendo os dois domínios idênticos.

## Fluxo

1. Você clica em **Publish** no Lovable.
2. O Lovable sincroniza o código para o repositório do GitHub.
3. O Vercel detecta o push na branch principal e faz o deploy.

## Passo a passo (uma vez só)

### 1. Conectar o projeto ao GitHub
No Lovable: menu **+** (canto inferior esquerdo do chat) → **GitHub** →
**Connect project** → autorize e crie o repositório.

### 2. Ligar o repositório ao Vercel
No painel do Vercel: **Add New… → Project → Import Git Repository** e escolha o
repositório criado.

Configurações do projeto no Vercel:

- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist` (se o build gerar `dist/client`, use `dist/client`)
- Install Command: `npm install`

Em **Settings → Git**, mantenha **Production Branch = main** e
**Automatic deployments from Git = enabled**. Só com isso todo push do Lovable
já dispara um deploy.

### 3. Variáveis de ambiente no Vercel
Copie para **Settings → Environment Variables** (Production e Preview):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Os valores são os mesmos do arquivo `.env` do projeto. Sem eles, o app no
Vercel não conecta no backend e as funções ficam diferentes do Lovable.

### 4. (Opcional) Deploy Hook redundante
Se você quiser forçar o deploy mesmo quando o Vercel não detectar o push:

1. Vercel → **Settings → Git → Deploy Hooks** → crie um hook
   (nome: `lovable-publish`, branch: `main`) e copie a URL.
2. GitHub → repositório → **Settings → Secrets and variables → Actions** →
   **New repository secret** com o nome `VERCEL_DEPLOY_HOOK` e a URL como valor.

O workflow `.github/workflows/vercel-deploy.yml` já está no repositório e chama
esse hook a cada push na branch principal (e também pode ser rodado manualmente
em **Actions → Deploy to Vercel → Run workflow**).

> Se você não criar o secret, o workflow falha propositalmente com uma mensagem
> explicativa — o deploy normal do Vercel via Git continua funcionando.

## Checklist de paridade entre os domínios

- [ ] Mesma branch (`main`) publicada nos dois lados
- [ ] Mesmas variáveis `VITE_*` no Vercel e no Lovable
- [ ] URL do Vercel adicionada nas URLs de redirect do login (auth)
- [ ] Após publicar, conferir `/status-login` nos dois domínios
