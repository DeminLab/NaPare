export function ProductShowcase() {
  return (
    <figure
      className="product-preview"
      aria-label="Демонстрационный интерфейс личного кабинета НаПаре"
    >
      <div className="preview-window">
        <header className="preview-topbar">
          <span className="preview-brand">
            <span aria-hidden="true">NP</span> НаПаре
          </span>
          <span className="preview-date">Понедельник, 24 ноября</span>
          <span className="preview-avatar" aria-label="Профиль Анны Ким">
            АК
          </span>
        </header>

        <div className="preview-workspace">
          <nav className="preview-sidebar" aria-label="Пример навигации кабинета">
            <span className="preview-nav-item is-active">Мой день</span>
            <span className="preview-nav-item">Расписание</span>
            <span className="preview-nav-item">Пространство пары</span>
            <span className="preview-nav-item">Объявления</span>
            <span className="preview-nav-caption">АККАУНТ</span>
            <span className="preview-nav-item">Профиль</span>
          </nav>

          <div className="preview-main">
            <div className="preview-heading">
              <div>
                <span className="preview-kicker">ЛИЧНЫЙ КАБИНЕТ</span>
                <h2>Мой день</h2>
              </div>
              <span className="preview-date-mobile">24 ноября</span>
            </div>

            <div className="preview-summary">
              <span><strong>3</strong> пары сегодня</span>
              <span><strong>1</strong> новое объявление</span>
            </div>

            <div className="preview-columns">
              <section className="preview-panel preview-schedule" aria-label="Пример расписания">
                <div className="preview-panel-heading">
                  <h3>Расписание</h3>
                  <span>Сегодня</span>
                </div>
                <div className="preview-lesson is-current">
                  <time>09:00</time>
                  <span className="preview-lesson-mark" />
                  <div>
                    <strong>Введение в программирование</strong>
                    <small>А. С. Иванова · ауд. 204</small>
                  </div>
                  <span className="preview-status">Сейчас</span>
                </div>
                <div className="preview-lesson">
                  <time>11:40</time>
                  <span className="preview-lesson-mark" />
                  <div>
                    <strong>Дискретная математика</strong>
                    <small>М. В. Петров · ауд. 316</small>
                  </div>
                </div>
                <div className="preview-lesson">
                  <time>14:00</time>
                  <span className="preview-lesson-mark" />
                  <div>
                    <strong>Проектный семинар</strong>
                    <small>А. С. Иванова · ауд. 408</small>
                  </div>
                </div>
              </section>

              <div className="preview-side-column">
                <section className="preview-panel preview-notice" aria-label="Пример уведомления">
                  <span className="preview-notice-icon" aria-hidden="true">↗</span>
                  <div>
                    <span className="preview-label">ИЗМЕНЕНИЕ</span>
                    <strong>Аудитория обновлена</strong>
                    <small>Проектный семинар · теперь 408</small>
                  </div>
                </section>

                <section className="preview-panel preview-prep" aria-label="Пример подготовки к паре">
                  <div className="preview-panel-heading">
                    <h3>К семинару</h3>
                    <span>14:00</span>
                  </div>
                  <strong>Подготовить тезисы</strong>
                  <p>Тема: цифровая среда университета</p>
                  <span className="preview-context">Объявление преподавателя</span>
                </section>

                <div className="preview-bottom-grid">
                  <section className="preview-panel preview-teacher" aria-label="Пример карточки преподавателя">
                    <span className="preview-teacher-avatar">АИ</span>
                    <span><strong>А. С. Иванова</strong><small>Преподаватель</small></span>
                  </section>
                  <section className="preview-panel preview-progress" aria-label="Пример статистики посещаемости">
                    <span className="preview-progress-ring"><strong>92</strong></span>
                    <span><small>Посещаемость</small><strong>за месяц</strong></span>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption>Пример интерфейса · данные демонстрационные</figcaption>
    </figure>
  );
}
