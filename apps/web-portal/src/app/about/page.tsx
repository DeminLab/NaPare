import SEOMeta from '../../components/SEO';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <SEOMeta
        title="О проекте NaPare — Операционная система учебного дня студента"
        description="О NaPare: B2B2C SaaS платформа для управления учебным процессом студентов, преподавателей и администрации вузов"
        keywords="о NaPare, проект, разработчик, Демин Данила Алексеевич, учебный процесс, студенты, преподаватели, вузы"
      />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            О проекте NaPare
          </h1>
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              NaPare — это операционная система учебного дня студента, которая объединяет все аспекты образовательного процесса в одном месте. Проект разработан индивидуальным предпринимателем Данилой Алексеевичем.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Основная идея проекта — сделать учебный процесс максимально удобным и прозрачным для всех участников: студентов, преподавателей и администрации вузов.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Для студентов</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Расписание пар</li>
                <li>• Объявления преподавателей</li>
                <li>• Домашние задания</li>
                <li>• Файлы и материалы</li>
                <li>• Обсуждения</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Для преподавателей</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Управление расписанием</li>
                <li>• Отметки посещаемости</li>
                <li>• Объявления</li>
                <li>• Домашние задания</li>
                <li>• Аналитика</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Для администрации</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Управление вузом</li>
                <li>• Управление группами</li>
                <li>• Управление пользователями</li>
                <li>• Настройки платформы</li>
                <li>• Аналитика</li>
              </ul>
            </div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Разработчик
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              Проект создан и поддерживается <strong>Данилой Алексеевичем</strong>, индивидуальным предпринимателем. Разработчик отвечает за архитектуру, разработку и поддержку платформы NaPare.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
