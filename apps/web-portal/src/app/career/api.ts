let refreshing: Promise<void> | null = null;
export class CareerApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'CareerApiError';
  }
}

export async function careerApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = () => fetch('/api/v1' + path, { ...options, headers: { 'Content-Type':'application/json', ...options.headers, Authorization:'Bearer '+(localStorage.getItem('accessToken') || '') } });
  let response = await send();
  if (response.status === 401 && localStorage.getItem('refreshToken')) {
    if (!refreshing) refreshing = (async () => {
      const refreshed = await fetch('/api/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:localStorage.getItem('refreshToken')})});
      let tokens:unknown;
      try{tokens=await refreshed.json();}catch{throw new CareerApiError(refreshed.status,'Войдите в аккаунт заново');}
      if(!refreshed.ok||!tokens||typeof tokens!=='object'||!('accessToken'in tokens)||typeof tokens.accessToken!=='string'||!('refreshToken'in tokens)||typeof tokens.refreshToken!=='string') throw new CareerApiError(refreshed.status,'Войдите в аккаунт заново');
      localStorage.setItem('accessToken',tokens.accessToken);localStorage.setItem('refreshToken',tokens.refreshToken);
    })().finally(()=>{refreshing=null;});
    await refreshing;response=await send();
  }
  const text=await response.text();let data: {message?:string|string[]} | null = null;try{data=text?JSON.parse(text):null;}catch{if(response.ok)throw new Error('Не удалось прочитать ответ сервера');}
  if(!response.ok) throw new CareerApiError(response.status,Array.isArray(data?.message)?data.message.join('. '):data?.message || (response.status===429?'Слишком много запросов. Повторите немного позже.':response.status===503?'Сервис временно занят. Повторите немного позже.':'Не удалось выполнить действие'));
  return data as T;
}
