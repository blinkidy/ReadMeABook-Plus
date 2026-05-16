export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const axios = (await import('axios')).default;
    const { RMAB_USER_AGENT } = await import('@/lib/utils/user-agent');
    axios.defaults.headers.common['User-Agent'] = RMAB_USER_AGENT;
  }
}
