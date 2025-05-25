let NAME = ''
let lastSearchIngredients = '';
let lastSearchMealType = '';
let lastRecipesData = [];
let lastSortedAsc = true;


async function loadView(view) {
    const response = await fetch(`views/${view}`);
    const html = await response.text();
    document.getElementById('app').innerHTML = html;

    if (view === 'welcomeView.html') {
        document.getElementById('startBtn').onclick = () => {
            if (document.getElementById("name_input").value !== ""){
                NAME = document.getElementById("name_input").value
                loadView('mainView.html')}
            else
                alert("Введите имя!")
        }

    }
    if (view === 'mainView.html') {
        setupMainView();
    }
}

// Инициализация приложения
window.onload = () => loadView('welcomeView.html');


function setupMainView() {
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
    ingredientInput.onkeydown = (e) => { if (e.key === "Enter") fetchRecipes(); };

    document.getElementById("hello").innerHTML = `<p>Добро пожаловать, ${NAME}</p>`

    if (recipesData.length) {
        renderRecipes(recipesData);
        renderStats(recipesData);
    }

    async function fetchRecipes() {
        const API_KEY = 'fd458f7b70da4fde867ea1fa030e5147';
        const ingredients = ingredientInput.value.trim();
        const meal = mealType.value;

        lastSearchIngredients = ingredients;
        lastSearchMealType = meal;

        let url = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(ingredients)}&number=5&apiKey=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        recipesData = await Promise.all(data.map(async (item) => {
            const infoUrl = `https://api.spoonacular.com/recipes/${item.id}/information?includeNutrition=true&apiKey=${API_KEY}`;
            const infoResp = await fetch(infoUrl);
            const info = await infoResp.json();
            return {
                id: item.id,
                title: info.title,
                image: info.image,
                calories: info.nutrition && info.nutrition.nutrients
                    ? (info.nutrition.nutrients.find(n => n.name === "Calories")?.amount || 0)
                    : "—",
                ingredientLines: info.extendedIngredients
                    ? info.extendedIngredients.map(ing => ing.original)
                    : [],
                dishTypes: info.dishTypes || []
            };
        }));

        let filteredRecipes = recipesData;
        if (meal) {
            filteredRecipes = recipesData.filter(recipe =>
                recipe.dishTypes.includes(meal)
            );
        }

        lastRecipesData = filteredRecipes; // Сохраняем результаты поиска
        renderRecipes(filteredRecipes);
        renderStats(filteredRecipes);
    }

    function renderRecipes(recipes) {
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
    }

    function sortRecipes() {
        if (recipesData.length === 0) return;
        recipesData.sort((a, b) => {
            const calA = a.calories === "—" ? 0 : a.calories;
            const calB = b.calories === "—" ? 0 : b.calories;
            return sortedAsc ? calA - calB : calB - calA;
        });
        sortedAsc = !sortedAsc;
        lastSortedAsc = sortedAsc;
        renderRecipes(recipesData);
    }

    function renderStats(recipes) {
        if (recipes.length === 0) {
            statsPanel.innerHTML = '';
            return;
        }
        const withCalories = recipes.filter(r => typeof r.calories === "number" && !isNaN(r.calories));
        const avgCalories = withCalories.length
            ? Math.round(withCalories.reduce((sum, r) => sum + r.calories, 0) / withCalories.length)
            : '—';
        statsPanel.innerHTML = `
      <b>Найдено рецептов:</b> ${recipes.length} <br>
      <b>Средняя калорийность:</b> ${avgCalories === '—' ? 'нет данных' : avgCalories + ' ккал'}
    `;
    }

    async function openRecipeDetails(recipeId) {
        const API_KEY = 'fd458f7b70da4fde867ea1fa030e5147';
        const url = `https://api.spoonacular.com/recipes/${recipeId}/information?includeNutrition=true&apiKey=${API_KEY}`;
        const resp = await fetch(url);
        const info = await resp.json();

        const titleRu = await translateMyMemory(info.title);

        const ingredientsRu = [];
        for (const ing of info.extendedIngredients) {
            ingredientsRu.push(await translateMyMemory(ing.original));
        }

        let instructionsRu = info.instructions
            ? await translateLongTextMyMemory(info.instructions)
            : '<i>Инструкция отсутствует</i>';

        const detailsHtml = `
    <div class="recipe-detail-view">
      <button id="backToListBtn">Назад к списку</button>
      <h2>${titleRu}</h2>
      <img src="${info.image}" alt="${titleRu}" style="max-width:320px; border-radius:10px; margin-bottom:18px;">
      <div class="nutrition">
        <b>Калорийность:</b> ${
            info.nutrition && info.nutrition.nutrients
                ? Math.round(info.nutrition.nutrients.find(n => n.name === "Calories")?.amount || 0) + ' ккал'
                : '—'
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

        document.getElementById('app').innerHTML = detailsHtml;

        document.getElementById('backToListBtn').onclick = () => {
            loadView('mainView.html');
        };

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
        const response = await fetch(url);
        const data = await response.json();
        return data.responseData.translatedText;
    }





}
