# Plano: Automação da Chave de IA e Segurança

O objetivo é automatizar o fluxo de configuração de IA para que, ao salvar a chave no perfil, o app reconheça imediatamente a ativação sem necessidade de recarregar manualmente ou lidar com falhas de sincronização, além de garantir que a infraestrutura suporte o uso público com segurança.

## Alterações

### Frontend

- **Ajustar `AiKeyManager` em `src/routes/_authenticated/app.perfil.tsx`**:
    - Simplificar o fluxo de validação e salvamento.
    - Adicionar feedback visual imediato de "IA Ativa".
    - Garantir que a invalidação de queries (`user-ai-config`) dispare atualizações em componentes dependentes (como o gerador de treinos).

### Backend (Server Functions)

- **Otimizar `src/lib/ai-router.server.ts`**:
    - Garantir que o fallback para `process.env.OPENAI_API_KEY` (Lovable AI Gateway) funcione corretamente quando o usuário não tiver chave própria.
    - Melhorar o tratamento de erros para que mensagens amigáveis cheguem ao usuário se a chave estiver expirada ou incorreta.

### Infraestrutura e Segurança

- **Ponte de Funções (`src/lib/server-bridge.ts` e `src/routes/api/public/bridge.ts`)**:
    - Confirmar que as ações de IA (`saveAiConfigAction`, etc.) estão devidamente expostas e protegidas na ponte para suportar o deploy na Vercel/domínios externos.
    - Verificar políticas de RLS na tabela `user_ai_configs` para garantir que usuários só acessem suas próprias chaves.

## Detalhes Técnicos

- A tabela `user_ai_configs` armazena as chaves de forma segura no Supabase (criptografadas ou protegidas por RLS).
- O uso de `supabaseAdmin` no lado do servidor garante que o roteador de IA consiga ler a chave para processamento sem expô-la ao cliente em texto puro desnecessariamente (apenas o gerenciador de chaves a lê para edição).
- A integração com a ponte (`bridge`) permite que o app funcione de forma idêntica em `lovable.app` e `vercel.app`.

## Próximos Passos

1. Revisar RLS da tabela `user_ai_configs`.
2. Implementar as melhorias no `AiKeyManager`.
3. Testar o fluxo de geração de treino com chave própria vs chave padrão.
