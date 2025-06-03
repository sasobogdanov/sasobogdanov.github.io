document.addEventListener('DOMContentLoaded', function () {
    const tabs = document.querySelectorAll('.tab');
    const contentContainer = document.querySelector('.content-container');

    function loadTabContent(tabName) {
        fetch(`assets/html/${tabName}.html`)
            .then(response => response.text()).then(html => {
                contentContainer.innerHTML = html;
                if (tabName === 'hide' && typeof initHideTab === 'function') {
                    initHideTab();
                }
            });
    }

    function setActiveTab(tabName) {
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        loadTabContent(tabName);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            setActiveTab(this.dataset.tab);
        });
    });

    setActiveTab('hide');
});
