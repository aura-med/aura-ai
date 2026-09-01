/* Sophi landing page — interaction + data visuals. No dependencies. */
(function () {
  'use strict'

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var SVGNS = 'http://www.w3.org/2000/svg'

  function el(name, attrs) {
    var node = document.createElementNS(SVGNS, name)
    for (var k in attrs) node.setAttribute(k, attrs[k])
    return node
  }

  /* ---------------------------------------------------------- mobile nav */
  var nav = document.querySelector('.site-nav')
  var toggle = document.querySelector('.nav-toggle')
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open')
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
    nav.querySelectorAll('.mobile-panel a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open')
        toggle.setAttribute('aria-expanded', 'false')
      })
    })
  }

  /* ------------------------------------- product shot: scale to container */
  // The app recreation is laid out at a fixed 1100×700 so its internal
  // proportions stay true, then scaled down to whatever width it is given.
  var shotWindow = document.querySelector('.shot-window')
  var appShot = document.getElementById('appShot')
  function fitShot() {
    if (!shotWindow || !appShot) return
    var s = shotWindow.clientWidth / 1100
    appShot.style.transform = 'scale(' + s + ')'
    shotWindow.style.height = Math.round(700 * s) + 'px'
  }
  if (shotWindow && appShot) {
    fitShot()
    window.addEventListener('resize', fitShot)
    window.addEventListener('load', fitShot)
  }

  /* ------------------------------------- live rows inside the product shot */
  var alerts = [
    { ini: 'JP', name: 'J. Pereira', meta: 'CB · #4', dv: 'ACWR 1.42', s: 88 },
    { ini: 'TA', name: 'T. Almeida', meta: 'CM · #9', dv: 'Sleep debt', s: 71 },
    { ini: 'AS', name: 'A. Silva', meta: 'RW · #7', dv: 'Fatigue', s: 66 },
    { ini: 'MC', name: 'M. Costa', meta: 'LB · #11', dv: 'HRV drop', s: 58 },
    { ini: 'RN', name: 'R. Nunes', meta: 'ST · #19', dv: 'Decel load', s: 44 }
  ]
  function appBand(s) {
    if (s >= 85) return '#ff4d6d'
    if (s >= 65) return '#ff7043'
    if (s >= 40) return '#f6ad55'
    return '#00e5a0'
  }
  var alertRows = document.getElementById('alertRows')
  if (alertRows) {
    alertRows.innerHTML = alerts.map(function (a, i) {
      return '<div class="app-row">' +
        '<span class="app-avat">' + a.ini + '</span>' +
        '<span><span class="app-nm">' + a.name + '</span><br><span class="app-mt">' + a.meta + '</span></span>' +
        '<span class="app-dv">' + a.dv + '</span>' +
        '<span class="app-sc" style="color:' + appBand(a.s) + '">' + a.s + '</span>' +
        '</div>'
    }).join('')
  }

  /* --------------------------------------- availability calendar (card 1) */
  var AVAIL = [24, 23, 25, 22, 20, 21, 23, 24, 22, 19, 21, 23, 25, 24]
  var MIN = 16, MAX = 26
  var calSvg = document.getElementById('calSvg')

  function calPoint(i, v) {
    return [6 + i * (248 / (AVAIL.length - 1)), 72 - ((v - MIN) / (MAX - MIN)) * 60]
  }

  function buildCalendar() {
    if (!calSvg) return
    var pts = AVAIL.map(function (v, i) { return calPoint(i, v) })
    var line = document.getElementById('calLine')
    var area = document.getElementById('calArea')
    var dotsG = document.getElementById('calDots')

    line.setAttribute('points', pts.map(function (p) { return p[0] + ',' + p[1] }).join(' '))
    area.setAttribute('d',
      'M' + pts[0][0] + ',78 L' + pts.map(function (p) { return p[0] + ',' + p[1] }).join(' L') +
      ' L' + pts[pts.length - 1][0] + ',78 Z')
    area.style.opacity = 0

    pts.forEach(function (p, i) {
      var last = i === AVAIL.length - 1
      dotsG.appendChild(el('circle', {
        cx: p[0], cy: p[1], r: last ? 3.6 : 2.4,
        fill: last ? '#3763D9' : '#FFFFFF',
        stroke: '#3763D9', 'stroke-width': last ? 1.5 : 1.4, opacity: 0
      }))
    })

    var axis = document.getElementById('calAxis')
    if (axis) {
      var today = new Date()
      var label = function (back) {
        var d = new Date(today.getTime() - back * 86400000)
        return d.getDate() + '/' + (d.getMonth() + 1)
      }
      axis.innerHTML = '<span>' + label(13) + '</span><span>' + label(7) + '</span><span>' + label(0) + '</span>'
    }
  }
  buildCalendar()

  function playCalendar() {
    if (!calSvg) return
    var line = document.getElementById('calLine')
    var area = document.getElementById('calArea')
    var circles = document.getElementById('calDots').childNodes
    var now = document.getElementById('calNow')
    var target = AVAIL[AVAIL.length - 1]

    if (reduce) {
      line.style.strokeDashoffset = '0'
      area.style.opacity = 1
      for (var i = 0; i < circles.length; i++) circles[i].setAttribute('opacity', 1)
      if (now) now.textContent = target
      return
    }

    line.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)'
    line.style.strokeDashoffset = '0'
    area.style.transition = 'opacity .9s ease .5s'
    area.style.opacity = 1

    for (var j = 0; j < circles.length; j++) {
      ;(function (c, k) {
        setTimeout(function () {
          c.style.transition = 'opacity .3s ease'
          c.setAttribute('opacity', 1)
        }, 220 + k * 95)
      })(circles[j], j)
    }

    if (now) {
      var start = performance.now()
      ;(function step(t) {
        var p = Math.min((t - start) / 1200, 1)
        now.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)))
        if (p < 1) requestAnimationFrame(step)
      })(start)
    }
  }

  /* ------------------------------------------------- problem tick chart */
  var ticks = document.getElementById('probTicks')
  var TICKS = [38, 52, 44, 61, 48, 70, 55, 92, 64, 47, 58, 40, 86, 51, 45, 63, 39, 55, 96, 60, 43, 57, 49, 68, 42, 53]
  if (ticks) {
    TICKS.forEach(function (h) {
      var i = document.createElement('i')
      i.style.height = '2px'
      i.dataset.h = h
      if (h > 84) i.className = 'hot'
      ticks.appendChild(i)
    })
  }

  function playTicks() {
    if (!ticks) return
    ticks.querySelectorAll('i').forEach(function (i, k) {
      var run = function () { i.style.height = (parseInt(i.dataset.h, 10) / 100 * 46) + 'px' }
      if (reduce) { run(); return }
      i.style.transition = 'height .5s cubic-bezier(.4,0,.2,1)'
      setTimeout(run, k * 26)
    })
  }

  /* ------------------------------------------------------- newsletter */
  // Progressive enhancement only. Without JS the form does a plain POST to Brevo and the
  // browser lands on Brevo's own confirmation page — which is why target="_blank" is set
  // in the markup. With JS we post in the background and keep the reader here.
  //
  // The honeypot and the timing check below are noise reduction, nothing more: anyone can
  // read the action URL out of the page source and POST straight to it. Double opt-in on
  // the Brevo side is the control that actually works, because a bot never clicks the
  // confirmation link.
  var newsForm = document.getElementById('newsForm')
  if (newsForm && window.fetch && window.FormData) {
    var newsStatus = document.getElementById('newsStatus')
    var okCopy = newsForm.getAttribute('data-success') || ''
    var badCopy = newsForm.getAttribute('data-error') || ''
    var shownAt = Date.now()

    newsForm.addEventListener('submit', function (ev) {
      // Filled honeypot, or submitted implausibly fast: drop it silently. Reporting an
      // error would just tell a bot what tripped it.
      if (newsForm.email_address_check.value !== '' || Date.now() - shownAt < 3000) {
        ev.preventDefault()
        return
      }

      ev.preventDefault()
      var btn = newsForm.querySelector('button[type=submit]')
      if (btn) btn.disabled = true
      newsStatus.className = 'news-status'
      newsStatus.textContent = ''

      // URLSearchParams, not FormData: this sends application/x-www-form-urlencoded,
      // byte-for-byte what the native form would post. FormData would send multipart.
      fetch(newsForm.action, {
        method: 'POST',
        body: new URLSearchParams(new FormData(newsForm)),
        mode: 'no-cors'
      })
        .then(function () {
          // no-cors gives an opaque response, so a resolved promise is all we can read.
          // It means the request left the browser, not that Brevo accepted it — hence
          // wording that points at the confirmation email rather than claiming success.
          newsForm.classList.add('sent')
          newsStatus.className = 'news-status ok'
          newsStatus.textContent = okCopy
        })
        .catch(function () {
          if (btn) btn.disabled = false
          newsStatus.className = 'news-status bad'
          newsStatus.textContent = badCopy
          // Fall back to a real submit — .submit() skips this handler, so no loop.
          newsForm.submit()
        })
    })
  }

  /* --------------------------------------------------- reveal on scroll */
  var revealed = new WeakSet()
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting || revealed.has(e.target)) return
      revealed.add(e.target)
      e.target.classList.add('in')

      if (e.target.querySelector && e.target.querySelector('#calSvg')) playCalendar()
      if (e.target.querySelector && e.target.querySelector('#probTicks')) playTicks()

      var bars = e.target.querySelectorAll ? e.target.querySelectorAll('[data-w]') : []
      bars.forEach(function (b) { b.style.width = b.dataset.w + '%' })
    })
  }, { threshold: 0.25, rootMargin: '0px 0px -40px 0px' })

  document.querySelectorAll('.reveal').forEach(function (n) { io.observe(n) })

  // Safety net: if the observer never fires (very tall viewports, odd renderers),
  // nothing should stay invisible.
  window.addEventListener('load', function () {
    setTimeout(function () {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (n) {
        var r = n.getBoundingClientRect()
        if (r.top < window.innerHeight && r.bottom > 0) n.classList.add('in')
      })
    }, 1200)
  })
})()
