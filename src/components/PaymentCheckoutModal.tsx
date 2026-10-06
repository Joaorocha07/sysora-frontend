'use client';

import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import { CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { errorMessage, subscriptionsApi, type PlanId } from '@/lib/api';
import { money } from '@/lib/format';
import { FormError, Modal } from './ui';

if (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, { locale: 'pt-BR' });
}

interface Props {
  plan: { id: PlanId; name: string; priceCents: number };
  payerEmail: string;
  onClose: () => void;
  onSuccess: (sub: Awaited<ReturnType<typeof subscriptionsApi.checkout>>['subscription']) => void;
}

type MpFormData = {
  token: string;
  payer?: { email?: string };
};

export function PaymentCheckoutModal({ plan, payerEmail, onClose, onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: MpFormData) {
    setError(null);
    try {
      const { subscription, pending: inReview } = await subscriptionsApi.checkout({
        cardTokenId: formData.token,
        payerEmail: formData.payer?.email || payerEmail,
        plan: plan.id,
        cycle: 'MONTHLY',
      });
      setSuccess(true);
      setPending(inReview);
      onSuccess(subscription);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  }

  return (
    <Modal
      title={`Assinar plano ${plan.name}`}
      description={`${money(plan.priceCents)}/mês · cobrado automaticamente todo mês no cartão cadastrado`}
      onClose={onClose}
      wide
    >
      {success ? (
        <div className="stack" style={{ alignItems: 'center', padding: '32px 0', gap: 12 }}>
          <CheckCircle size={40} style={{ color: 'var(--color-success, #22c55e)' }} />
          <strong>{pending ? 'Pagamento em análise' : 'Assinatura ativada com sucesso!'}</strong>
          <p className="muted" style={{ textAlign: 'center' }}>
            {pending
              ? `Seu plano ${plan.name} será ativado assim que o Mercado Pago confirmar a cobrança.`
              : `Seu plano ${plan.name} já está ativo. O cartão será cobrado automaticamente todo mês.`}
          </p>
        </div>
      ) : (
        <>
          <FormError message={error} />
          {!process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ? (
            <p className="muted">Pagamento via cartão não configurado. Fale com o suporte.</p>
          ) : (
            <CardPayment
              initialization={{ amount: plan.priceCents / 100, payer: { email: payerEmail } }}
              customization={{
                paymentMethods: { maxInstallments: 1 },
                visual: { hideFormTitle: true },
              }}
              onSubmit={async (formData) => handleSubmit(formData as MpFormData)}
              onError={(err) => setError(err.message)}
            />
          )}
        </>
      )}
    </Modal>
  );
}
