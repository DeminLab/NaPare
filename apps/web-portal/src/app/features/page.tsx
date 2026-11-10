import SEOMeta from '../../components/SEO';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <SEOMeta
        title="Возможности NaPare — Операционная система учебного дня студента"
        description="Все возможности NaPare: управление расписанием, домашними заданиями, материалами, обсуждениями и учётом отсутствий"
        keywords="возможности NaPare, функции, расписание, ДЗ, материалы, обсуждения, отсутствия"
      />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Возможности NaPare
          </h1>
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Пространство пары
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                У каждого занятия своя страница со всем контентом: преподаватель, группа, файлы, задания, объявления, обсуждение, история изменений, посещаемость.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Мой день
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                Персональная сводка учебного дня с учётом расписания, изменений, ДЗ и отсутствий.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Центр статуса
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                Статусы отсутствий с расчётом пар и подтверждением куратора. Полный учёт пропусков.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Мультивузовость
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                Архитектура для подключения любых вузов с поддержкой различных систем расписания.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Коннекторы
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                Универсальный интерфейс получения расписания из внешних источников: Excel/CSV, iCal, Moodle, СИБИТ, РУЭ.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
