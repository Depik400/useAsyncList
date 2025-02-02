import { ref } from 'vue';

function bound(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), ms);
  };
}

const useAsyncList = (options) => {
  let menuSelector = options.childrenWrapper;
  let menuParentSelector = options.scrollableElement;
  let mutationObserver = null;
  let intersectionObserver = null;
  let page = 1;
  let node = null;
  let parent = null;
  let items = ref([]);
  let count = ref(0);
  let loading = ref(false);
  function mutationCb(mutations) {
    const target = mutations.at(-1);
    if (target?.addedNodes[0] && mutations.length > 1) {
      intersectionObserver.observe(target.addedNodes[0]);
    }
  }
  function mergeItems(newItems, reset) {
    if (options.fetchModifier) {
      newItems = options.fetchModifier(newItems);
    }
    if (!reset) {
      items.value.push(...newItems);
    } else {
      items.value = newItems;
    }
  }
  async function getItems(fetchOptions) {
    /** @type {null|((a: *[], count: number) => void)} */
    let cb = null;
    if (typeof fetchOptions.cb === 'function') {
      cb = fetchOptions.cb;
      delete fetchOptions.cb;
    }
    if (options.handleInside) {
      loading.value = true;
      const response = await options.fetchFn(fetchOptions);
      loading.value = false;
      let items = [];
      if (response?.items) {
        count.value = response.count || 0;
        items = response.items;
      } else if (response?.data?.items) {
        count.value = response.data.count || 0;
        items = response.data.items;
      }
      mergeItems(items, fetchOptions.reset);
      if (cb) {
        cb(items, count.value);
      }
    } else {
      options.fetchFn(fetchOptions);
    }
  }

  function intersectionCb(entries, observer) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        page++;
        getItems({ page });
        observer.unobserve(entry.target);
      }
    }
  }

  function setMenuObservers() {
    node = document.querySelector(menuSelector);
    parent = document.querySelector(menuParentSelector);
    intersectionObserver = new IntersectionObserver(intersectionCb, {
      root: parent,
      rootMargin: '0px',
      threshold: 0.15,
    });
    mutationObserver = new MutationObserver(mutationCb);
    mutationObserver.observe(node, { childList: true });
  }

  setMenuObservers();
  const fetchFromStart = bound((object = {}) => {
    page = 1;
    const obs = new IntersectionObserver(
      (entries, observer) => {
        if (entries.at(0)?.isIntersecting) {
          getItems({ page: page, reset: true, ...object });
          observer.disconnect();
        }
      },
      { root: parent, rootMargin: '0px', threshold: 0.15 }
    );
    const firstOfList = document.querySelector(
      menuSelector + ' > :nth-child(1)'
    );
    if (firstOfList && firstOfList.offsetParent !== null) {
      obs.observe(firstOfList);
      parent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      obs.disconnect();
      getItems({ page: page, reset: true, ...object });
    }
  }, options.timeoutBeforeFetch);
  function loadAll(fetchOptions) {
    console.log(fetchOptions);
    getItems({ page: -1, reset: true, ...fetchOptions });
  }
  return {
    reload: fetchFromStart,
    loadAll,
    items,
    count,
    loading,
  };
};

export { useAsyncList, bound };
