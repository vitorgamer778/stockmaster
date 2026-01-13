import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const MASTER_PHONE = '62998208705';
const MASTER_PASSWORD = '12279154';

test('fluxo de importação: upload -> /api/extract -> produto aparece', async () => {
  // mock alert to capture OTP
  const alerts: string[] = [];
  const origAlert = window.alert;
  window.alert = (msg?: any) => { alerts.push(String(msg)); };

  render(<App />);

  // If login form is present, perform login flow; otherwise assume auto-logged-in (test env)
  if (screen.queryByPlaceholderText(/Telefone/i)) {
    const phoneInput = screen.getByPlaceholderText(/Telefone/i);
    const passInput = screen.getByPlaceholderText(/Senha/i);
    userEvent.type(phoneInput, MASTER_PHONE);
    userEvent.type(passInput, MASTER_PASSWORD);
    userEvent.click(screen.getByRole('button', { name: /ENTRAR NO SISTEMA/i }));

    // OTP should have been alerted
    await waitFor(() => expect(alerts.length).toBeGreaterThan(0), { timeout: 3000 });
    const otpMsg = alerts[alerts.length - 1];
    const otp = otpMsg.match(/(\d{6})/)?.[1] || '000000';

    // fill otp
    const otpInput = screen.getByRole('textbox'); // the big OTP input
    userEvent.type(otpInput, otp);
    userEvent.click(screen.getByRole('button', { name: /VALIDAR ACESSO/i }));
  }

  // Open settings (cog button)
  const adminBtn = screen.getAllByRole('button').find(b => b.innerHTML.includes('fa-cog')) as HTMLButtonElement;
  await userEvent.click(adminBtn);
  await waitFor(() => expect(screen.getByText(/Importar via Nota Fiscal/i)).toBeInTheDocument(), { timeout: 2000 });

  // Mock fetch para emular o endpoint /api/extract (assíncrono e estável)
  const origFetch = (global as any).fetch;
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, data: [{ code: '123', name: 'PRODUTO TESTE', categoryName: 'Geral' }] }) }));
  (global as any).fetch = fetchMock;

  // Prepare FileReader mock (chamada onload assíncrona)
  const origFileReader = (global as any).FileReader;
  class MockFileReader {
    result: string | null = null;
    onload: ((e: any) => void) | null = null;
    readAsDataURL() {
      this.result = 'data:application/pdf;base64,ZmFrZQ==';
      setTimeout(() => { if (this.onload) this.onload({ target: { result: this.result } }); }, 0);
    }
  }
  (global as any).FileReader = MockFileReader;

  // Wait for the settings modal to render and find the hidden file input
  await waitFor(() => expect(screen.getByText(/Importar via Nota Fiscal/i)).toBeInTheDocument());
  const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
  expect(fileInput).toBeTruthy();
  const file = new File(['dummy'], 'nota.pdf', { type: 'application/pdf' });

  // fire upload using userEvent to ensure proper FileList is set, wrapped in act
  await userEvent.upload(fileInput, file);

  // Wait for product to appear in the table (input value)
  await waitFor(() => expect(screen.queryByDisplayValue(/PRODUTO TESTE/i)).toBeTruthy(), { timeout: 5000 });

  // restore
  window.alert = origAlert;
  (global as any).FileReader = origFileReader;
});
