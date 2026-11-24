# Especificação Técnica — Fase 36: Validador de Receitas Digitais ICP-Brasil, CFM, CFF & Invalidação de Reutilização (Lei 14.063/2020 e Portaria 344/98)

## 1. Visão Geral
No varejo farmacêutico brasileiro contemporâneo, a grande maioria das prescrições de medicamentos sujeitos a controle especial (Portaria 344/98 - Listas A1, A2, A3, B1, B2, C1 e C2) e antimicrobianos (RDC 20/2011) são emitidas digitalmente através de plataformas como Memed, Conexa, CFM e CFF, assinadas com certificado digital padrão ICP-Brasil.

A farmácia é obrigada a:
1. Validar a autenticidade e integridade da assinatura ICP-Brasil do médico/prescritor (verificação de certificado A1/A3, data de emissão e CRM/UF).
2. Verificar o prazo regulamentar de validade da receita (ex: 30 dias para Notificação de Receita B e antimicrobianos).
3. **Impedir a reutilização fraudulenta:** Marcar e registrar a dispensação (baixa/carimbo eletrônico) com CNPJ da farmácia, CRF do farmacêutico dispensador, lotes aviados, quantidade e data/hora.
4. Exportar os dados da receita diretamente para a Pré-Venda do Balcão ([F1]) e para o Livro de Registro SNGPC / BMPO sem necessidade de digitação manual de CRM, nome do médico ou dados do paciente.

## 2. Requisitos Técnicos
1. **Banco de Dados (Migration 035 - `035_digital_prescriptions.sql`):**
   - Tabela `digital_prescriptions`:
     - `id`, `store_id`, `prescription_code` (hash ou código Memed/CFM/ITI, ex: "MEM-8899-ABCD" ou UUID), `access_token`
     - `prescriber_name`, `prescriber_crm`, `prescriber_uf`, `prescriber_document` (CPF)
     - `patient_name`, `patient_cpf`, `patient_birth_date`
     - `icp_signature_valid` (0 ou 1), `icp_cert_issuer`, `icp_signed_at`
     - `prescription_type` ('CONTROLLED_B1', 'CONTROLLED_C1', 'ANTIMICROBIAL', 'REGULAR')
     - `issued_at`, `expires_at`
     - `status` ('VALID', 'DISPENSED', 'EXPIRED', 'REVOKED')
     - `dispensed_at`, `dispensed_by_crf`, `dispensed_pre_sale_id`, `dispensed_store_id`
   - Tabela `digital_prescription_items`:
     - `id`, `prescription_id`, `medication_name`, `dosage`, `quantity_prescribed`, `quantity_dispensed`, `instructions`
2. **Domain Service (`DigitalPrescriptionService`):**
   - `lookupAndValidatePrescription(code)`: Consulta receita, valida assinatura ICP-Brasil, prazo de validade e se já foi dispensada.
   - `dispensePrescription(prescriptionId, input)`: Realiza a baixa/carimbo da receita vinculando ao pré-venda e bloqueando reuso em qualquer loja da rede.
   - `importToPreSale(prescriptionId, storeId)`: Converte itens da receita em itens da pré-venda no balcão.
3. **Endpoints REST Fastify (`/api/digital-prescriptions/*`):**
   - `POST /api/digital-prescriptions/validate`: Valida QR Code / código digital.
   - `POST /api/digital-prescriptions/dispense`: Marca dispensação com CRF do farmacêutico.
   - `GET /api/digital-prescriptions/:code`: Consulta detalhes da receita.
   - `POST /api/digital-prescriptions/create-sample`: Gerador de receitas digitais simuladas para homologação no balcão.
4. **Interface React:**
   - Modal de Validação de Receita Digital acionável diretamente no Balcão ([F1]) via leitor de código de barras ou atalho.
   - Exibição de selo verde "ICP-Brasil Autêntica" com CRM e detalhes do médico.
   - Botão "Importar Medicamentos para Pré-Venda".
   - Alerta impeditivo em caso de receita já dispensada ou vencida.
