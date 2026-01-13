import * as msw from 'msw';
const { rest } = msw as any;

export const handlers = [
  rest.post('/api/extract', async (req, res, ctx) => {
    return res(ctx.json({ ok: true, data: [{ code: '123', name: 'PRODUTO TESTE', categoryName: 'Geral' }] }));
  }),
];
