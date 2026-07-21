# Assets do Capacitor

Coloque aqui os arquivos de origem para gerar ícones e splash screens:

- `resources/icon.png` — 1024x1024 (ícone base do app)
- `resources/splash.png` — 2732x2732 (splash com logo centralizado)
- `resources/splash-dark.png` — 2732x2732 (opcional, splash dark mode)

Depois rode no seu computador:

```bash
npx capacitor-assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'
```

Isso gera todos os tamanhos necessários para Android e iOS automaticamente.
