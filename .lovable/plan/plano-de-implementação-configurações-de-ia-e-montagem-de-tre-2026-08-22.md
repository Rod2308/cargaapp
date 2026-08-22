# Plano de Implementação: Configurações de IA e Montagem de Treino

Este plano detalha a implementação da funcionalidade de chaves de API personalizadas por usuário (OpenAI, Anthropic, Gemini) e a nova ferramenta de montagem de treinos assistida por IA.

## 1. Banco de Dados e Segurança
- Criar tabela `user_ai_configs` para armazenar `user_id`, `provider` e `api_key`.
- Habilitar RLS para que apenas o proprietário possa ler/escrever.
- **Segurança:** As chaves serão armazenadas no Supabase. O acesso via frontend será restrito (campo password).
- Implementar `has_ai_config` como uma RPC ou via `createServerFn` para checagem rápida.

## 2. Interface do Usuário (Perfil)
- Adicionar seção "Configurações de IA" em `app.perfil.tsx`.
- Componente `AiKeyManager`:
  - Seletor de provedor.
  - Input de chave (tipo password com toggle de visibilidade).
  - Botão "Validar chave": dispara uma Server Function que testa a chave contra a API do provedor.
  - Botão "Salvar": habilitado apenas após validação.
  - Botão "Remover chave".

## 3. Roteamento de IA (Backend)
- Criar `src/lib/ai-router.functions.ts` (ou similar):
  - Função centralizada `getAiCompletion`.
  - Lógica:
    1. Busca configuração do usuário.
    2. Se existir chave válida, roteia a requisição para o provedor escolhido (usando a chave do usuário).
    3. Se não existir, utiliza o provedor/chave padrão do sistema.
    4. Trata erros específicos de chaves de usuário (créditos, revogada) emitindo alertas claros.
- Padronização de Prompt: Injetar um prompt-base estruturado para garantir respostas JSON consistentes entre provedores.

## 4. Funcionalidade "Montar Treino com IA"
- Criar nova rota/modal `app.treinos.gerar.tsx`.
- Formulário de entrada:
  - Objetivo (Hipertrofia, etc.).
  - Dias/Semana.
  - Nível de Experiência.
  - Grupos Musculares.
  - Equipamentos.
- Geração:
  - Envia dados para o roteador de IA.
  - Recebe JSON estruturado.
- Revisão:
  - Renderiza o treino proposto em uma lista editável.
  - Permite alterar exercícios, séries ou remover itens antes de salvar definitivamente no histórico/planos do usuário.

## Detalhes Técnicos
- **Zod:** Validação rigorosa dos esquemas JSON retornados pela IA.
- **Server Functions:** Todo o tráfego de API de IA passará pelo servidor para ocultar chaves e gerenciar requisições.
- **UX:** Feedback visual claro durante a validação da chave e a geração do treino.
