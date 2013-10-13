var dataGetter;
var host = "http://pda.5284.com.tw/MQS/businfo1.jsp";

function DataGetter(browserElement) {
  var b = this._browser = browserElement;
  b.addEventListener('DOMWindowCreated',
                     this._windowCreated.bind(this),
                     true);
}

DataGetter.prototype = {
  _browser: null,
  _state: 0, // 0: before start page loaded.
             // 1: start page loaded.
             // 2: bus page loaded.
  _currentList: 0,
  _currentIndex: 1, // The first option is a hint, we should just skip.
  _currentRoute: null,

  // Receiving a object { route: string, stop: [ array of stops in fore direction,
  //                                             array of stops in back direction] }
  // in argument.
  onBusDataRetrieved: null,

  // no argument.
  onDone: null,

  _formatAndStore: function(obj) {
    if (typeof this.onBusDataRetrieved === 'function') {
      try {
        this.onBusDataRetrieved.call(null, obj);
      } catch (e) {
        // Error in callback, skip.
      }
    }
  },

  _extractNodeListToArray: function(nodeList) {
    var i, r = [];
    for (i = 0; i < nodeList.length; ++i) {
      r.push(nodeList.item(i));
    }
    return r;
  },

  _fetchList: function(selectList) {
    if (!selectList ||
        selectList.length == 0 ||
        this._currentList >= selectList.length) {
      // No more select to fetch, this round is ended.
      if (typeof this.onDone === 'function') {
        try {
          this.onDone.call(null);
        } catch (e) {
          // Error in callback, skip.
        }
      }
      return;
    }
    
    var select = selectList[this._currentList];
    if (this._currentIndex < select.length) {
      var i = this._currentIndex++;
      select.selectedIndex = i;
      this._currentRoute = select.options.item(i).textContent;
      select.onchange();
    } else {
      // end of this list, read next.
      this._currentList++;
      this._currentIndex = 1;
      this._fetchList(selectList);
    }
  },

  _parseCurrentContentAsStationList: function() {
    var table1selector = ".formattable1 > tbody:nth-child(1) > tr:nth-child(5) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1) > table:nth-child(1)";
    var table2selector = ".formattable1 > tbody:nth-child(1) > tr:nth-child(5) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > table:nth-child(1)";
    var b = this._browser;
    var doc = b.contentDocument;

    var table1 = doc.querySelector(table1selector);
    var table2 = doc.querySelector(table2selector);

    function listStationName(element) {
      var stationNodeList = element.querySelectorAll("tr td:nth-child(1)");
      var stationList = [];
      var i;
      for (i = 0; i < stationNodeList.length; ++i) {
        stationList.push(stationNodeList.item(i).textContent);
      }
      return stationList;
    }

    return [listStationName(table1),
            listStationName(table2)];
  },

  _windowCreated: function() {
    var b = this._browser;
    var doc = b.contentDocument;
    doc.addEventListener('DOMContentLoaded', this._contentLoaded.bind(this));
  },

  _contentLoaded: function() {
    var b = this._browser;
    var doc = b.contentDocument;
    switch(this._state) {
    case 0:
      this._currentList = 0;
      this._state = 1;
      this._fetchList(this._extractNodeListToArray(
        doc.querySelectorAll(".formattable1 select")));
      break;
    case 1:
      if (b.contentWindow.location.href.
          startsWith("http://pda.5284.com.tw/MQS/businfo2.jsp?routename=")) {
        this._state = 2;
        // Okay, bus table has been loaded, let's parse the dom.
        this._formatAndStore({
          route: this._currentRoute,
          stop: this._parseCurrentContentAsStationList()
        });

        // Done, go back and read next.
        b.goBack();
      }
      break;
    case 2:
      // back from page of a bus.
      this._state = 1;
      this._fetchList(this._extractNodeListToArray(
        doc.querySelectorAll(".formattable1 select")));
      break;
    }
  },

  start: function start(initUrl) {
    var b = this._browser;
    this._state = 0;
    b.loadURI(initUrl);
  }
};

window.addEventListener("load", function() {
  var allRoute = [];
  dataGetter = new DataGetter(document.getElementById('stationBrowser')); 
  dataGetter.onBusDataRetrieved = function(obj) {
    allRoute.push(obj);
    dump("LOG: Getting: " + obj.route + "\n");
  };

  dataGetter.onDone = function() {
    dump("OK: " + JSON.stringify(allRoute));
  };

  dataGetter.start(host);
});
