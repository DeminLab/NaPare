import SEOMeta from '../../components/SEO';

export default function OwnerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <SEOMeta
        title="Демин Данила Алексеевич — ИП, Разработчик NaPare"
        description="Демин Данила Алексеевич — индивидуальный предприниматель, разработчик платформы NaPare. Операционная система учебного дня студента."
        keywords="Демин Данила Алексеевич, ИП, разработчик, NaPare, операционная система, учеба, студенты, B2B2C, SaaS"
      />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Демин Данила Алексеевич
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            Индивидуальный предприниматель
          </p>
          <p className="text-xl text-gray-600 mb-6">
            Разработчик и владелец платформы NaPare
          </p>
          <p className="text-lg text-gray-500 mb-8">
            Операционная система учебного дня студента
          </p>
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              О проекте
            </h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              NaPare — это B2B2C SaaS платформа, объединяющая все аспекты учебного дня студента в одном месте: расписание, изменения, задания, материалы, обсуждения и учёт отсутствий — всё вокруг конкретной пары.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Проект создан и поддерживается индивидуальным предпринимателем Деминым Данилой Алексеевичем для улучшения образовательного процесса.
            </p>
          </div>
          <div className="mt-8">
            <a
              href="https://napare.sano.ru/"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              На главную
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
