let NAME = ''
let lastSearchIngredients = '';
let lastSearchMealType = '';
let lastRecipesData = [];
let lastSortedAsc = true;

function log(message, level = 'info') {
    console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`);
}

async function loadView(view) {
    log(`Загрузка view: ${view}`);
    try {
        const response = await fetch(`views/${view}`);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки view: ${view}. Статус: ${response.status}`);
        }
        const html = await response.text();
        document.getElementById('app').innerHTML = html;

        if (view === 'welcomeView.html') {
            document.getElementById('startBtn').onclick = () => {
                if (document.getElementById("name_input").value !== "") {
                    NAME = document.getElementById("name_input").value
                    log(`Имя пользователя установлено: ${NAME}`);
                    loadView('mainView.html')
                } else
                    alert("Введите имя!")
            }

        }
        if (view === 'mainView.html') {
            setupMainView();
        }
        log(`View успешно загружена: ${view}`);
    } catch (error) {
        log(`Ошибка при загрузке view: ${view}. Ошибка: ${error.message}`, 'error');
        document.getElementById('app').innerHTML = `<p style="color: red;">Ошибка загрузки страницы: ${error.message}</p>`;
    }
}

// Инициализация приложения
window.onload = () => loadView('welcomeView.html');


function setupMainView() {
    log('Инициализация mainView');
    const searchBtn = document.getElementById('searchBtn');
    const sortBtn = document.getElementById('sortBtn');
    const ingredientInput = document.getElementById('ingredientInput');
    const mealType = document.getElementById('mealType');
    const recipesDiv = document.getElementById('recipes');
    const statsPanel = document.getElementById('statsPanel');

    let recipesData = lastRecipesData.length ? lastRecipesData : [];
    let sortedAsc = lastSortedAsc;

    ingredientInput.value = lastSearchIngredients;
    mealType.value = lastSearchMealType;

    searchBtn.onclick = fetchRecipes;
    sortBtn.onclick = sortRecipes;
    ingredientInput.onkeydown = (e) => {
        if (e.key === "Enter") fetchRecipes();
    };

    document.getElementById("hello").innerHTML = `<p>Добро пожаловать, ${NAME}</p>`

    if (recipesData.length) {
        renderRecipes(recipesData);
        renderStats(recipesData);
    }

    async function fetchRecipes() {
        log('Начало выполнения fetchRecipes');
        const API_KEY = 'fd458f7b70da4fde867ea1fa030e5147';
        const ingredients = ingredientInput.value.trim();
        const meal = mealType.value;

        lastSearchIngredients = ingredients;
        lastSearchMealType = meal;

        try {
            let url = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(ingredients)}&number=5&apiKey=${API_KEY}`;
            log(`Запрос к API: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Ошибка запроса: ${response.status}`);
            }
            const data = await response.json();
            log(`Данные успешно получены, количество рецептов: ${data.length}`);

            recipesData = await Promise.all(data.map(async (item) => {
                const infoUrl = `https://api.spoonacular.com/recipes/${item.id}/information?includeNutrition=true&apiKey=${API_KEY}`;
                log(`Запрос информации о рецепте: ${infoUrl}`);
                const infoResp = await fetch(infoUrl);
                if (!infoResp.ok) {
                    throw new Error(`Ошибка запроса информации о рецепте: ${infoResp.status}`);
                }
                const info = await infoResp.json();
                log(`Информация о рецепте ${item.id} успешно получена`);
                return {
                    id: item.id,
                    title: info.title,
                    image: info.image,
                    calories: info.nutrition && info.nutrition.nutrients ?
                        (info.nutrition.nutrients.find(n => n.name === "Calories")?.amount || 0) :
                        "—",
                    ingredientLines: info.extendedIngredients ?
                        info.extendedIngredients.map(ing => ing.original) :
                        [],
                    dishTypes: info.dishTypes || []
                };
            }));

            let filteredRecipes = recipesData;
            if (meal) {
                filteredRecipes = recipesData.filter(recipe =>
                    recipe.dishTypes.includes(meal)
                );
                log(`Фильтрация рецептов по типу блюда: ${meal}, найдено ${filteredRecipes.length} рецептов`);
            }

            lastRecipesData = filteredRecipes; // Сохраняем результаты поиска
            renderRecipes(filteredRecipes);
            renderStats(filteredRecipes);
            log('fetchRecipes успешно завершена');
        } catch (error) {
            log(`Ошибка в fetchRecipes: ${error.message}`, 'error');
            recipesDiv.innerHTML = `<p style="color: red;">Ошибка при получении рецептов: ${error.message}</p>`;
        }
    }

    function renderRecipes(recipes) {
        log(`Отрисовка ${recipes.length} рецептов`);
        recipesDiv.innerHTML = '';
        if (recipes.length === 0) {
            recipesDiv.innerHTML = '<p>Рецепты не найдены.</p>';
            return;
        }
        recipes.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `
        <img src="${recipe.image}" alt="${recipe.title}">
        <div class="recipe-details">
          <h3>${recipe.title}</h3>
          <p>Калорийность: ${recipe.calories ? Math.round(recipe.calories) + ' ккал' : '—'}</p>
          <p>Ингредиенты: ${recipe.ingredientLines.join(', ')}</p>
          <button class="details-btn" data-id="${recipe.id}">Подробнее</button>
        </div>
      `;
            recipesDiv.appendChild(card);
        });

        document.querySelectorAll('.details-btn').forEach(btn => {
            btn.onclick = async function() {
                const id = this.getAttribute('data-id');
                if (!id) {
                    alert('Ошибка: id рецепта не найден!');
                    return;
                }
                // Передаём также текущие данные поиска для возврата
                await openRecipeDetails(id);
            };
        });
        log(`Отрисовка рецептов завершена`);
    }

    function sortRecipes() {
        log('Начало сортировки рецептов');
        if (recipesData.length === 0) return;
        recipesData.sort((a, b) => {
            const calA = a.calories === "—" ? 0 : a.calories;
            const calB = b.calories === "—" ? 0 : b.calories;
            return sortedAsc ? calA - calB : calB - calA;
        });
        sortedAsc = !sortedAsc;
        lastSortedAsc = sortedAsc;
        renderRecipes(recipesData);
        log('Сортировка рецептов завершена');
    }

    function renderStats(recipes) {
        log('Отрисовка статистики');
        if (recipes.length === 0) {
            statsPanel.innerHTML = '';
            return;
        }
        const withCalories = recipes.filter(r => typeof r.calories === "number" && !isNaN(r.calories));
        const avgCalories = withCalories.length ?
            Math.round(withCalories.reduce((sum, r) => sum + r.calories, 0) / withCalories.length) :
            '—';
        statsPanel.innerHTML = `
      <b>Найдено рецептов:</b> ${recipes.length} <br>
      <b>Средняя калорийность:</b> ${avgCalories === '—' ? 'нет данных' : avgCalories + ' ккал'}
    `;
        log('Отрисовка статистики завершена');
    }

    async function openRecipeDetails(recipeId) {
        log(`Открытие деталей рецепта с ID: ${recipeId}`);
        const app = document.getElementById("app")
        app.innerHTML = '' +
            '<div class="spinner"></div>' +
            '<p style="text-align:center;">Загрузка...</p>';

        const API_KEY = 'fd458f7b70da4fde867ea1fa030e5147';
        const url = `https://api.spoonacular.com/recipes/${recipeId}/information?includeNutrition=true&apiKey=${API_KEY}`;
        try {
            log(`Запрос к API для получения деталей рецепта: ${url}`);
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(`Ошибка запроса: ${resp.status}`);
            }
            const info = await resp.json();
            log(`Информация о рецепте ${recipeId} успешно получена`);

            const titleRu = await translateMyMemory(info.title);

            const ingredientsRu = [];
            for (const ing of info.extendedIngredients) {
                ingredientsRu.push(await translateMyMemory(ing.original));
            }

            let instructionsRu = info.instructions ?
                await translateLongTextMyMemory(info.instructions) :
                '<i>Инструкция отсутствует</i>';

            const detailsHtml = `
    <div class="recipe-detail-view">
      <button id="backToListBtn">Назад к списку</button>
      <h2>${titleRu}</h2>
      <img src="${info.image}" alt="${titleRu}" style="max-width:320px; border-radius:10px; margin-bottom:18px;">
      <div class="nutrition">
        <b>Калорийность:</b> ${
                info.nutrition && info.nutrition.nutrients ?
                    Math.round(info.nutrition.nutrients.find(n => n.name === "Calories")?.amount || 0) + ' ккал' :
                    '—'
            }<br>
        <b>Порций:</b> ${info.servings || '—'}
      </div>
      <h3>Ингредиенты:</h3>
      <ul>
        ${ingredientsRu.map(ing => `<li>${ing}</li>`).join('')}
      </ul>
      <div class="instructions">
        <h3>Инструкция:</h3>
        ${instructionsRu}
      </div>
    </div>
  `;

            app.innerHTML = detailsHtml;

            document.getElementById('backToListBtn').onclick = () => {
                loadView('mainView.html');
            };
            log(`Детали рецепта ${recipeId} успешно отображены`);

        } catch (error) {
            log(`Ошибка при загрузке деталей рецепта ${recipeId}: ${error.message}`, 'error');
            app.innerHTML = `<p style="color: red;">Ошибка загрузки деталей рецепта: ${error.message}</p>`;
        }

    }

    async function translateLongTextMyMemory(text, from = 'en', to = 'ru', maxLen = 500) {
        const parts = [];
        let start = 0;
        while (start < text.length) {
            let end = start + maxLen;
            if (end < text.length) {
                let lastSpace = text.lastIndexOf(' ', end);
                let lastDot = text.lastIndexOf('.', end);
                let splitPos = Math.max(lastSpace, lastDot);
                if (splitPos > start) {
                    end = splitPos + 1;
                }
            }
            parts.push(text.slice(start, end).trim());
            start = end;
        }

        const translatedParts = [];
        for (const part of parts) {
            if (part.length > 0) {
                translatedParts.push(await translateMyMemory(part, from, to));
            }
        }
        return translatedParts.join(' ');
    }

    async function translateMyMemory(text, from = 'en', to = 'ru') {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
        try {
            log(`Запрос перевода к MyMemory: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Ошибка перевода: ${response.status}`);
            }
            const data = await response.json();
            log(`Перевод получен: ${data.responseData.translatedText}`);
            return data.responseData.translatedText;
        } catch (error) {
            log(`Ошибка при переводе текста "${text}": ${error.message}`, 'error');
            return text; // В случае ошибки возвращаем исходный текст
        }
    }
}
