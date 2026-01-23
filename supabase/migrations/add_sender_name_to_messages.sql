-- Migração: Adicionar campo sender_name na tabela messages
-- Este campo armazena o nome do remetente em mensagens de grupo

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sender_name TEXT NULL;

-- Comentário explicativo
COMMENT ON COLUMN messages.sender_name IS 'Nome do remetente da mensagem (usado em grupos para identificar quem enviou)';
