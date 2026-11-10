const API = "https://jsonplaceholder.typicode.com";
let allPosts = [];
let allUsers = [];
let commentCounts = {};
let commentsCache = {};

let displayedCount = 9;
let currentSearch = "";
let currentWriter = "";
let currentSort = "newest";
let searchTimer;
let currentModalPostId = null;

const cardsGrid = document.getElementById("articles-grid");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");

const writerSelect = document.getElementById("writer-select");
const sortSelect = document.getElementById("sort-select");

const resultCount = document.getElementById("result-count");
const clearFiltersBtn = document.getElementById("clear-filters-btn");
const loadMoreBtn = document.getElementById("load-more-btn");

const errorState = document.getElementById("error-state");
const retryBtn = document.getElementById("retry-btn");
const emptyState = document.getElementById("empty-state");
const skeletonTemplate = document.getElementById("skeleton-template");

const statPosts = document.getElementById("stat-posts");
const statWriters = document.getElementById("stat-writers");

const articleModal = document.getElementById("article-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCover = document.getElementById("modal-cover");
const modalPostId = document.getElementById("modal-post-id");
const modalAuthor = document.getElementById("modal-author");
const modalWriterName = document.getElementById("modal-writer-name");
const modalEmail = document.getElementById("modal-email");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalComments = document.getElementById("modal-comments");
const modalCommentsTitle = document.getElementById("modal-comments-title");

const themeToggle = document.getElementById("theme-toggle");
const menuBtn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
const backToTopBtn = document.getElementById("back-to-top");

const newsletterForm = document.getElementById("newsletter-form");
const newsletterEmail = document.getElementById("newsletter-email");
const newsletterMessage = document.getElementById("newsletter-message");


const gradients = [
  "from-[#E4572E] to-[#F2A65A]",
  "from-[#2E86AB] to-[#7FC8F8]",
  "from-[#3D9970] to-[#9BE7C4]",
  "from-[#6C4AB6] to-[#B9A6F2]",
  "from-[#D1495B] to-[#F6A6B2]"
];

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, function (char) {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return characters[char];
  });
}

function getInitials(name) {
  return name
    .split(" ")
    .map(function (word) {
      return word[0];
    })
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function highlightText(text, search) {
  const safeText = escapeHTML(text);

  if (!search) {
    return safeText;
  }

  const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("(" + safeSearch + ")", "gi");

  return safeText.replace(
    regex,
    '<mark class="bg-brand/20 text-brand dark:text-brand-light rounded px-0.5">$1</mark>'
  );
}

function getWriter(userId) {
  return allUsers.find(function (user) {
    return user.id === userId;
  }) || {
    name: "Unknown",
    email: ""
  };
}


function showSkeletons() {
  cardsGrid.innerHTML = "";

  for (let i = 0; i < 6; i++) {
    const skeleton = skeletonTemplate.content.cloneNode(true);
    cardsGrid.appendChild(skeleton);
  }
}


async function initApp() {
  showSkeletons();

  errorState.classList.add("hidden");
  emptyState.classList.add("hidden");

  try {
    const results = await Promise.all([
      fetch(API + "/posts"),
      fetch(API + "/users")
    ]);

    const postsResponse = results[0];
    const usersResponse = results[1];

    if (!postsResponse.ok || !usersResponse.ok) {
      throw new Error("Failed to load data");
    }

    allPosts = await postsResponse.json();
    allUsers = await usersResponse.json();

    statPosts.textContent = allPosts.length;
    statWriters.textContent = allUsers.length;

    populateWriters();

    readUrlParams();

    updateAndRender();

    loadCommentCounts();

  } catch (error) {
    console.error(error);

    cardsGrid.innerHTML = "";
    errorState.classList.remove("hidden");
    resultCount.textContent = "Unable to load articles";
  }
}


async function loadCommentCounts() {
  try {
    const response = await fetch(API + "/comments");

    if (!response.ok) {
      throw new Error("Failed to load comments");
    }

    const comments = await response.json();

    commentCounts = {};

    comments.forEach(function (comment) {
      if (!commentCounts[comment.postId]) {
        commentCounts[comment.postId] = 0;
      }

      commentCounts[comment.postId]++;
    });

    updateAndRender();

  } catch (error) {
    console.error("Could not load comment counts:", error);
  }
}

function populateWriters() {
  writerSelect.innerHTML = '<option value="">All writers</option>';

  allUsers.forEach(function (user) {
    const option = document.createElement("option");

    option.value = user.id;
    option.textContent = user.name;

    writerSelect.appendChild(option);
  });
}


function readUrlParams() {
  const params = new URLSearchParams(window.location.search);

  const search = params.get("q");
  const author = params.get("author");
  const sort = params.get("sort");

  if (search) {
    currentSearch = search;
    searchInput.value = search;
  }

  if (author && allUsers.some(function (user) {
    return user.id === Number(author);
  })) {
    currentWriter = author;
    writerSelect.value = author;
  }

  const allowedSorts = ["newest", "oldest", "title-az", "title-za"];

  if (allowedSorts.includes(sort)) {
    currentSort = sort;
    sortSelect.value = sort;
  }
}

function updateUrlParams() {
  const params = new URLSearchParams();

  if (currentSearch) {
    params.set("q", currentSearch);
  }

  if (currentWriter) {
    params.set("author", currentWriter);
  }

  if (currentSort !== "newest") {
    params.set("sort", currentSort);
  }

  const query = params.toString();

  const newURL = window.location.pathname +
    (query ? "?" + query : "") +
    window.location.hash;

  window.history.replaceState(null, "", newURL);
}


function getFilteredPosts() {
  let filteredPosts = [...allPosts];

  if (currentSearch) {
    const search = currentSearch.toLowerCase();

    filteredPosts = filteredPosts.filter(function (post) {
      return (
        post.title.toLowerCase().includes(search) ||
        post.body.toLowerCase().includes(search)
      );
    });
  }

  // Filter by writer
  if (currentWriter) {
    filteredPosts = filteredPosts.filter(function (post) {
      return post.userId === Number(currentWriter);
    });
  }

  // Sort posts
  filteredPosts.sort(function (a, b) {
    if (currentSort === "newest") {
      return b.id - a.id;
    }

    if (currentSort === "oldest") {
      return a.id - b.id;
    }

    if (currentSort === "title-az") {
      return a.title.localeCompare(b.title);
    }

    if (currentSort === "title-za") {
      return b.title.localeCompare(a.title);
    }

    return 0;
  });

  return filteredPosts;
}


function updateAndRender() {
  const filteredPosts = getFilteredPosts();

  const visiblePosts = filteredPosts.slice(0, displayedCount);

  cardsGrid.innerHTML = "";

  emptyState.classList.add("hidden");

  resultCount.textContent =
    "Showing " + visiblePosts.length + " of " + filteredPosts.length + " articles";
  if (currentSearch || currentWriter) {
    clearFiltersBtn.classList.remove("hidden");
  } else {
    clearFiltersBtn.classList.add("hidden");
  }

  if (currentSearch) {
    clearSearchBtn.classList.remove("hidden");
  } else {
    clearSearchBtn.classList.add("hidden");
  }

  if (filteredPosts.length === 0) {
    emptyState.classList.remove("hidden");
  }

  visiblePosts.forEach(function (post) {
    const writer = getWriter(post.userId);

    const gradient = gradients[(post.id - 1) % gradients.length];

    const readTime = Math.max(
      1,
      Math.ceil(post.body.split(" ").length / 30)
    );

    const title = capitalize(post.title);

    const shortBody = post.body.length > 100
      ? post.body.substring(0, 100) + "..."
      : post.body;

    const commentsNumber = commentCounts[post.id] || 0;

    const card = document.createElement("article");

    card.className =
      "bg-card dark:bg-night-card border border-line dark:border-night-line rounded-card overflow-hidden shadow-sm hover:shadow-card hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col";

    card.setAttribute("data-id", post.id);
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Read article: " + title);

    card.innerHTML = `
      <div class="h-36 bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between text-white">

        <span class="font-mono text-xs uppercase tracking-widest font-semibold">
          #${post.id}
        </span>

        <div class="flex justify-end">
          <span class="font-mono text-[10px] bg-black/30 px-2 py-1 rounded">
            ${readTime} min read
          </span>
        </div>

      </div>

      <div class="p-5 space-y-3 flex-grow">

        <div class="flex items-center gap-2">

          <div class="w-7 h-7 rounded-full bg-brand/10 text-brand dark:text-brand-light font-bold flex items-center justify-center text-[10px]">
            ${escapeHTML(getInitials(writer.name))}
          </div>

          <span class="text-xs font-medium text-muted dark:text-night-muted">
            ${escapeHTML(writer.name)}
          </span>

        </div>

        <h3 class="font-display font-semibold text-xl leading-snug">
          ${highlightText(title, currentSearch)}
        </h3>

        <p class="text-sm text-muted dark:text-night-muted leading-relaxed">
          ${highlightText(shortBody, currentSearch)}
        </p>

        <div class="flex items-center justify-between pt-3 border-t border-line dark:border-night-line text-xs text-muted dark:text-night-muted">

          <span>${commentsNumber} comments</span>

          <span class="text-brand dark:text-brand-light font-medium">
            Read article →
          </span>

        </div>

      </div>
    `;

    card.addEventListener("click", function () {
      openModal(post, writer);
    });

    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(post, writer);
      }
    });

    cardsGrid.appendChild(card);
  });

  // Load More button
  if (displayedCount < filteredPosts.length) {
    loadMoreBtn.classList.remove("hidden");
  } else {
    loadMoreBtn.classList.add("hidden");
  }

  updateUrlParams();
}

// Article Modal

async function openModal(post, writer) {
  currentModalPostId = post.id;

  const gradient = gradients[(post.id - 1) % gradients.length];

  modalPostId.textContent = "#" + post.id;

  modalCover.className =
    "h-36 rounded-lg flex items-end p-4 text-white font-mono text-xs bg-gradient-to-br " +
    gradient;

  modalAuthor.textContent = getInitials(writer.name);
  modalWriterName.textContent = writer.name;
  modalEmail.textContent = writer.email;

  modalTitle.textContent = capitalize(post.title);
  modalBody.textContent = post.body;

  modalComments.innerHTML =
    '<p class="text-sm text-muted">Loading comments...</p>';

  modalCommentsTitle.textContent =
    "Comments (" + (commentCounts[post.id] || 0) + ")";

  articleModal.classList.remove("hidden");
  articleModal.classList.add("flex");

  document.body.style.overflow = "hidden";

  if (commentsCache[post.id]) {
    renderComments(commentsCache[post.id]);
    return;
  }

  try {
    const response = await fetch(API + "/comments?postId=" + post.id);

    if (!response.ok) {
      throw new Error("Failed to load comments");
    }

    const comments = await response.json();

    commentsCache[post.id] = comments;

    // Make sure the same article is still open
    if (currentModalPostId === post.id) {
      renderComments(comments);
    }

  } catch (error) {
    console.error(error);

    if (currentModalPostId === post.id) {
      modalComments.innerHTML =
        '<p class="text-sm text-muted">Unable to load comments. Please try again.</p>';
    }
  }
}

// Render Comments
function renderComments(comments) {
  modalComments.innerHTML = "";

  if (comments.length === 0) {
    modalComments.innerHTML =
      '<p class="text-sm text-muted">No comments found.</p>';

    return;
  }

  comments.forEach(function (comment) {
    const commentDiv = document.createElement("div");

    commentDiv.className =
      "bg-paper dark:bg-night p-4 rounded-lg border border-line dark:border-night-line space-y-2";

    commentDiv.innerHTML = `
      <span class="font-semibold text-brand dark:text-brand-light block text-xs">
        ${escapeHTML(comment.email)}
      </span>

      <h4 class="font-medium text-sm">
        ${escapeHTML(capitalize(comment.name))}
      </h4>

      <p class="text-sm text-muted dark:text-night-muted leading-relaxed">
        ${escapeHTML(comment.body)}
      </p>
    `;

    modalComments.appendChild(commentDiv);
  });
}

// Close Modal
function closeModal() {
  articleModal.classList.add("hidden");
  articleModal.classList.remove("flex");

  document.body.style.overflow = "";

  currentModalPostId = null;
}

modalCloseBtn.addEventListener("click", closeModal);

articleModal.addEventListener("click", function (event) {
  if (event.target === articleModal) {
    closeModal();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && !articleModal.classList.contains("hidden")) {
    closeModal();
  }
});


searchInput.addEventListener("input", function () {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(function () {
    currentSearch = searchInput.value.trim();

    displayedCount = 9;

    updateAndRender();
  }, 300);
});

clearSearchBtn.addEventListener("click", function () {
  clearTimeout(searchTimer);

  searchInput.value = "";
  currentSearch = "";
  displayedCount = 9;

  updateAndRender();
});


writerSelect.addEventListener("change", function () {
  currentWriter = writerSelect.value;

  displayedCount = 9;

  updateAndRender();
});

sortSelect.addEventListener("change", function () {
  currentSort = sortSelect.value;

  displayedCount = 9;

  updateAndRender();
});


clearFiltersBtn.addEventListener("click", function () {
  clearTimeout(searchTimer);

  currentSearch = "";
  currentWriter = "";

  searchInput.value = "";
  writerSelect.value = "";

  displayedCount = 9;

  updateAndRender();
});


loadMoreBtn.addEventListener("click", function () {
  displayedCount += 9;

  updateAndRender();
});



retryBtn.addEventListener("click", function () {
  initApp();
});



themeToggle.addEventListener("click", function () {
  const isDark = document.documentElement.classList.toggle("dark");

  localStorage.setItem("theme", isDark ? "dark" : "light");
});



menuBtn.addEventListener("click", function () {
  mobileMenu.classList.toggle("hidden");
});

const mobileLinks = mobileMenu.querySelectorAll("a");

mobileLinks.forEach(function (link) {
  link.addEventListener("click", function () {
    mobileMenu.classList.add("hidden");
  });
});



newsletterForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const email = newsletterEmail.value.trim();

  if (!newsletterEmail.checkValidity()) {
    newsletterMessage.textContent = "Please enter a valid email address.";
    newsletterMessage.className = "text-sm font-medium text-red-600";
    return;
  }

  newsletterMessage.textContent =
    "Thank you for subscribing, " + email + "!";

  newsletterMessage.className =
    "text-sm font-medium text-green-600";

  newsletterMessage.classList.remove("hidden");

  newsletterForm.reset();
});

window.addEventListener("scroll", function () {
  if (window.scrollY > 400) {
    backToTopBtn.classList.remove("opacity-0", "pointer-events-none");
  } else {
    backToTopBtn.classList.add("opacity-0", "pointer-events-none");
  }
});

backToTopBtn.addEventListener("click", function () {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});
initApp();