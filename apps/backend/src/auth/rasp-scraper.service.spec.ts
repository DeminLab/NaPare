import { RaspScraperService } from './rasp-scraper.service';

describe('RaspScraperService', () => {
  const sourceLesson = (groupId: number, code: number) => ({
    код: code,
    дата: '2026-09-17T00:00:00',
    начало: '10:10',
    конец: '11:40',
    деньНедели: 4,
    день_недели: 'Четверг',
    дисциплина: 'лек Тестовый предмет',
    преподаватель: 'Иванов И.И.',
    аудитория: '203',
    учебныйГод: '2026-2027',
    группа: `Группа-${groupId}`,
    замена: false,
    кодПреподавателя: 7,
    кодГруппы: groupId,
    номерПодгруппы: 0,
    типНедели: 1,
    номерЗанятия: 2,
  });

  const groups = [
    { name: 'ГМУ-25', id: 12136, kurs: 2, facul: 'ДОО', yearName: '2026-2027', facultyID: 24 },
    { name: 'ИН-16', id: 12134, kurs: 1, facul: 'ДОО', yearName: '2026-2027', facultyID: 24 },
  ];

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes groups and all catalog data from the source', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/Rasp/ListYears')) {
        return { ok: true, json: async () => ({ state: 1, data: { years: ['2025-2026', '2026-2027'] } }) } as Response;
      }
      if (url.includes('/api/raspGrouplist?year=2026-2027')) {
        return { ok: true, json: async () => ({ state: 1, data: groups }) } as Response;
      }
      const groupId = url.includes('idGroup=12136') ? 12136 : 12134;
      return {
        ok: true,
        json: async () => ({ state: 1, data: { rasp: [sourceLesson(groupId, groupId)] } }),
      } as Response;
    });
    global.fetch = fetchMock;

    const service = new RaspScraperService();
    const catalog = await service.getCatalog('2026-2027');

    expect(catalog.university).toEqual({ name: 'СИБИТ', city: 'Омск' });
    expect(catalog.groups).toHaveLength(2);
    expect(catalog.lessons).toHaveLength(2);
    expect(catalog.subjects).toEqual([
      { key: 'Тестовый предмет::лек', name: 'Тестовый предмет', type: 'лек', groupIds: ['12136', '12134'] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rejects a group that is not in the current source list', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/Rasp/ListYears')) {
        return { ok: true, json: async () => ({ state: 1, data: { years: ['2026-2027'] } }) } as Response;
      }
      return { ok: true, json: async () => ({ state: 1, data: groups }) } as Response;
    });
    global.fetch = fetchMock;

    const service = new RaspScraperService();
    await expect(service.getSchedule('99999')).rejects.toThrow('Группа не найдена');
  });
});
