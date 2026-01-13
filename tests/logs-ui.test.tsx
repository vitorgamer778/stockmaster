import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

test('logs modal opens from settings', async () => {
  render(<App />);
  const adminBtn = screen.getAllByRole('button').find(b => b.innerHTML.includes('fa-cog')) as HTMLButtonElement;
  userEvent.click(adminBtn);
  await waitFor(() => expect(screen.getByText(/Ver Logs de Atividade/i)).toBeInTheDocument(), { timeout: 1000 });
  const logsBtn = screen.getByText(/Ver Logs de Atividade/i);
  userEvent.click(logsBtn);
  await waitFor(() => expect(screen.getByText(/Logs de Atividade/i)).toBeInTheDocument(), { timeout: 1000 });
});
