# V19 — Notificações sem spam

- A sincronização no login não envia UPDATE quando o produto já está igual ao registro do Supabase.
- O autor original do produto é preservado nas atualizações.
- Eventos UPDATE sem alteração relevante são ignorados.
- Eventos Realtime duplicados em uma janela curta são ignorados.
- Eventos DELETE usam o registro antigo para remover o item local correto.
