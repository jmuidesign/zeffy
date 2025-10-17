document.addEventListener('DOMContentLoaded', () => {
  console.log('jsdeliver fonctionne !')

  // --- Helpers
  const stateAbbrMap = {
    Alabama: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    Florida: 'FL',
    Georgia: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Pennsylvania: 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY',
    'District of Columbia': 'DC',
  }
  const formatLocationFromFields = (city, region) => {
    const stateAbbr = stateAbbrMap[region] || region
    const formattedCity = city
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
    return `${formattedCity}, ${region} ${
      stateAbbr !== region ? '(' + stateAbbr + ')' : ''
    }`
  }

  // --- Prefilled rows
  const prefilledRows = {
    'hits-breast-cancer': 'breast cancer',
    //'hits-back-to-school': 'back to school',
    'hits-palestine': 'palestine',
    'hits-mens-health': 'mens health',
  }

  // --- DOM refs
  const els = {
    input: document.querySelector('#algolia-query'),
    button: document.querySelector('#search-trigger'),
    form: document.querySelector('#search-form'),
    hits: document.querySelector('#hits'),
    template: document.querySelector('.algolia-template-card'),

    // ✅ Manual Search fields (new additions)
    manualButton: document.querySelector('#search-trigger-manual'),
    manualForm: document.querySelector('#manual-search-form'),
    manualQuery: document.querySelector('#manual-query'),
    manualLocation: document.querySelector('#manual-location'),

    manualSearchTabButton: document.querySelector('#manual-search-tab-button'),
    smartSearchTabButton: document.querySelector('#smart-search-tab-button'),
    searchList: document.getElementById('search-terms'),
    searchTermsWrapper: document.getElementById('search-terms-wrapper'),
  }
  // Optional: Check only for required fields
  if (Object.values(els).some((e) => !e))
    return console.error('Missing DOM nodes:', els)

  // --- Algolia client
  const searchClient = algoliasearch(
    '22BX5DVBCL',
    'a8b2f7864f12d864a4fe7c9b288b28c1'
  )
  const index = searchClient.initIndex('forms')

  // --- InstantSearch setup
  const search = instantsearch({
    indexName: 'forms',
    searchClient,
    searchFunction(helper) {
      const q = (helper.state.query || '').trim()
      if (q) {
        helper.search()
      } else {
        // Clear both hits and pagination when query is empty
        els.hits.innerHTML = ''
        const paginationContainer = document.querySelector('#pagination')
        if (paginationContainer) {
          paginationContainer.innerHTML = ''
        }
      }
    },
  })

  const locations = new Map()

  // --- Location dropdown functionality
  const populateLocations = async () => {
    locations.clear()

    const query = els.manualQuery?.value || els.input?.value || ''
    const locationQuery = els.manualLocation?.value || ''

    if (!query) return

    try {
      const cityFacetResponse = await index.searchForFacetValues(
        'city',
        locationQuery,
        {
          filters: 'country:UnitedStates AND formType:DonationForm',
          query: query,
        }
      )

      const cityFilters = cityFacetResponse.facetHits.map(
        (cityHit) => `city:'${cityHit.value}'`
      )
      const regionSearchResponse = await index.search(query, {
        filters: `country:UnitedStates AND formType:DonationForm AND (${cityFilters.join(
          ' OR '
        )})`,
        attributesToRetrieve: ['city', 'region'],
        hitsPerPage: 1000,
      })

      regionSearchResponse.hits.forEach((hit) => {
        if (hit.city && hit.region) {
          const location = formatLocationFromFields(hit.city, hit.region)
          const manualSearchConfigureWithLocation =
            instantsearch.widgets.configure({
              hitsPerPage: 25,
              facetFilters: [
                'country:UnitedStates',
                'formType:DonationForm',
                `city:'${hit.city}' OR region:'${hit.region}'`,
              ],
              restrictSearchableAttributes: [
                'title',
                'description',
                'orgName',
                'fullAddress',
              ],
            })
          locations.set(location, {
            city: hit.city,
            region: hit.region,
            manualSearchConfigureWithLocation,
          })
        }
      })

      console.log(locations.keys())
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }

  els.searchTermsWrapper.style.display = 'none'

  function searchTerms() {
    const sortedLocations = Array.from(locations.keys()).sort()
    while (els.searchList.firstChild) {
      els.searchList.removeChild(els.searchList.firstChild)
    }
    for (let i = 0; i < sortedLocations.length; i++) {
      var li = document.createElement('li')
      li.innerHTML = `
          <a href="#" class="list-term">
            <span class="term-city">${sortedLocations[i]}</span>
          </a>
        `
      li.addEventListener('click', (e) => {
        e.preventDefault()
        els.manualLocation.value = e.target.innerHTML
        els.searchTermsWrapper.style.display = 'none'
        const manualSearchConfigureWithLocation = locations.get(
          sortedLocations[i]
        )?.manualSearchConfigureWithLocation
        setSearchWidgets(manualSearchConfigureWithLocation)
      })
      els.searchList.appendChild(li)
    }
  }

  // auto complete feature, activated on keystroke in the input.
  async function typeSearch() {
    var filter = els.manualLocation.value

    // 👇 Affiche seulement si au moins 2 lettres
    if (filter.length < 2) {
      els.searchTermsWrapper.style.display = 'none'
      return
    } else {
      await populateLocations()
      searchTerms()
      els.searchTermsWrapper.style.display = 'block'
    }
  }

  els.manualLocation.addEventListener('input', typeSearch)

  function checkFocus(e) {
    var activeTextarea = document.activeElement.id
    if (activeTextarea != 'autoInput') {
      els.searchTermsWrapper.style.display = 'none'
    } else {
      // 👇 On ne l’affiche que si 2 lettres mini
      if (els.manualLocation.value.length >= 2) {
        els.searchTermsWrapper.style.display = 'block'
      }
    }
  }
  document.addEventListener('mouseup', checkFocus, false)

  // --- Search input / trigger logic
  const customSearchBox = instantsearch.connectors.connectSearchBox(
    ({ refine }, isFirstRender) => {
      if (!isFirstRender) return

      const run = () => {
        // Switch to basic configure widget for regular search
        switchConfigureWidget(false)
        refine(els.input.value || '')
      }

      els.button.addEventListener('click', (e) => {
        e.preventDefault()
        run()
      })
      els.form.addEventListener('submit', (e) => {
        e.preventDefault()
        run()
      })
      els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          run()
        }
      })
      els.smartSearchTabButton.addEventListener('click', (e) => {
        e.preventDefault()
        els.input.value = ''
        run()
      })
    }
  )

  // Function to switch between configure widgets
  const switchConfigureWidget = (useManualConfig) => {
    setSearchWidgets(useManualConfig ? manualSearchConfigure : searchConfigure)
  }

  const customManualSearchBox = instantsearch.connectors.connectSearchBox(
    ({ refine }, isFirstRender) => {
      if (!isFirstRender) return

      const run = () => {
        const query = (els.manualQuery?.value || '').trim()
        const location = (els.manualLocation?.value || '').trim()

        // Switch to manual configure widget when location is provided
        const hasLocation = location.length > 0
        switchConfigureWidget(hasLocation)

        // Refine with combined query
        refine(query)
      }

      els.manualButton.addEventListener('click', (e) => {
        e.preventDefault()
        run()
      })
      els.manualForm.addEventListener('submit', (e) => {
        e.preventDefault()
        run()
      })
      els.manualQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          run()
        }
      })
      els.manualSearchTabButton.addEventListener('click', (e) => {
        e.preventDefault()
        els.manualQuery.value = ''
        els.manualLocation.value = ''
        run()
      })
    }
  )

  // --- Card builder utility
  const buildCard = (hit, template) => {
    const c = template.cloneNode(true)
    c.classList.remove('hidden', 'algolia-template-card')

    const q = (s) => c.querySelector(s)
    const txt = (s, v) => {
      const el = q(s)
      if (el) el.textContent = v || ''
    }
    const img = (s, src) => {
      const el = q(s)
      if (el)
        el.src =
          src ||
          'https://cdn.prod.website-files.com/60af7f6d21134db12548f5b9/68e68b0d5f8de744964b3d0e_donation.png'
    }
    const progress = (num, den) => {
      const w = q('.algolia-progress'),
        f = q('.algolia-progress-fill')
      if (!w || !f) return
      const pct = den > 0 ? Math.min(100, (num / den) * 100) : 0
      f.style.width = pct + '%'
      w.classList.toggle('hidden', den <= 0)
    }

    // Clean title (remove <mark>)
    const tDiv = document.createElement('div')
    tDiv.innerHTML = hit._highlightResult?.title?.value || hit.title || ''
    const cleanTitle = tDiv.textContent.trim()

    const vol = Number(hit.volume || 0)
    const donors = hit.numberOfPayments || 0
    const goal = hit.thermometer ? Number(hit.thermometer) : 0
    const addr = hit.location || hit.address

    txt('.algolia-card-title', cleanTitle)
    txt('.algolia-card-org-name', hit.orgName)
    txt('.algolia-card-amount', `${hit.volumeFormatted} raised so far`)
    txt('.algolia-card-donors', `${donors} donors`)
    txt(
      '.algolia-card-location',
      formatLocationFromFields(hit.city, hit.region)
    )
    progress(vol, goal)
    img('.algolia-card-banner', hit.bannerUrl)

    const goalEl = q('.algolia-card-goal')
    if (goalEl) goalEl.classList.add('hidden')

    // 🔗 Redirection au clic (ouvre dans un nouvel onglet)
    if (hit.formUrl) {
      c.style.cursor = 'pointer'
      c.addEventListener('click', (e) => {
        e.preventDefault()
        window.open(hit.formUrl, '_blank')
      })
    }

    c.setAttribute('data-form-url', hit.formUrl)

    // 🔗 Clique sur le lien absolu si présent
    const absLink = c.querySelector('.absolute_link')
    if (absLink && hit.formUrl) {
      absLink.setAttribute('href', hit.formUrl)
      absLink.setAttribute('target', '_blank')
      absLink.style.cursor = 'pointer'
      absLink.addEventListener('click', (e) => {
        e.preventDefault()
        console.log('Absolute link cliqué !', hit.formUrl)
        window.open(hit.formUrl, '_blank')
      })
    }

    return c
  }

  const manualSearchConfigure = instantsearch.widgets.configure({
    hitsPerPage: 25,
    facetFilters: ['country:UnitedStates', 'formType:DonationForm'],
    restrictSearchableAttributes: [
      'title',
      'description',
      'orgName',
      'fullAddress',
    ],
  })

  // Configure widgets for different search scenarios
  const searchConfigure = instantsearch.widgets.configure({
    hitsPerPage: 25,
    facetFilters: ['country:UnitedStates', 'formType:DonationForm'],
    restrictSearchableAttributes: ['title', 'description', 'orgName'],
  })

  // --- Hits widget
  const hitsWidget = instantsearch.widgets.hits({
    container: '#hits',
    templates: {
      item(hit) {
        return buildCard(hit, els.template).innerHTML
      },
      empty: '',
    },
  })

  // --- Pagination
  const pagination = instantsearch.widgets.pagination({
    container: '#pagination',
    padding: 2,
    showFirstLast: false,
    templates: { previous: '←', next: '→' },
  })

  const setSearchWidgets = (configureWidget) => {
    if (search.widgets?.length > 0) {
      search.removeWidgets(search.widgets)
    }
    search.addWidgets([
      configureWidget,
      customSearchBox({}),
      customManualSearchBox({}),
      hitsWidget,
      pagination,
    ])
  }
  setSearchWidgets(searchConfigure)
  search.start()

  // --- Prefilled rows
  const renderPrefilledRow = async (containerId, query) => {
    if (!query || containerId === 'hits') return
    const container = document.getElementById(containerId)
    if (!container) return console.warn(`Container not found: #${containerId}`)

    const tpl = container.querySelector('.algolia-template-card')
    if (!tpl) return console.warn(`Template missing in #${containerId}`)

    container
      .querySelectorAll(':scope > *:not(.algolia-template-card)')
      .forEach((e) => e.remove())
    try {
      const { hits } = await index.search(query, {
        hitsPerPage: 5,
        facetFilters: ['country:UnitedStates', 'formType:DonationForm'],
      })
      if (!hits.length) return
      const frag = document.createDocumentFragment()
      hits.forEach((hit) => frag.appendChild(buildCard(hit, tpl)))
      container.appendChild(frag)
    } catch (err) {
      console.error(`Search failed for "${query}" in #${containerId}`, err)
    }
  }

  Object.entries(prefilledRows).forEach(([id, q]) => renderPrefilledRow(id, q))

  // Toutes les elements avec la classe absolute_link ouvrent leur href dans un nouvel onglet
  document.querySelectorAll('.absolute_link').forEach((el) => {
    const url = el.getAttribute('href')
    if (url) {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    }
  })
})
