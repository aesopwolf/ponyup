var app = angular.module('app', [
  'ui.router',
  'ui.bootstrap',
  'ngAnimate',
  'ngFitText',
  'angular-loading-bar'
])
.filter('url', function ($sce) {
  return function (text) {
    return text?text.replace(/ /g, '-'):'';
  };
})
.directive('format', ['$filter', function ($filter) {
  return {
    require: '?ngModel',
    link: function (scope, elem, attrs, ctrl) {
      if (!ctrl) return;

      ctrl.$formatters.unshift(function (a) {
        return $filter(attrs.format)(ctrl.$modelValue)
      });

      ctrl.$parsers.unshift(function (viewValue) {
        var plainNumber = viewValue.replace(/[^\d|\-+|\.+]/g, '');
        elem.val($filter('number')(plainNumber));
        return plainNumber;
      });
    }
  };
}])
.directive('syncFocusWith', function($timeout, $rootScope) {
  return {
    restrict: 'A',
    scope: {
      focusValue: "=syncFocusWith"
    },
    link: function($scope, $element, attrs) {
      $scope.$watch("focusValue", function(currentValue, previousValue) {
        if (currentValue === true && !previousValue) {
          $element[0].focus();
        } else if (currentValue === false && previousValue) {
          $element[0].blur();
        }
      })
    }
  }
})
.directive('decimalPlaces', function() {
  return {
    link:function($scope, $element, attrs){
      $element.bind('keypress',function(e){
        var newVal=$element.val()+(e.charCode!==0?String.fromCharCode(e.charCode):'');
        if($element.val().search(/(.*)\.[0-9][0-9]/)===0 && newVal.length>$element.val().length){
          e.preventDefault();
        }
        var temp = $element.val().toString();

        if($element.val() > 9999.99) {
          e.preventDefault();
        }
      });
    }
  };
})
.config(function($stateProvider, $locationProvider, $uiViewScrollProvider, $urlRouterProvider) {
  $locationProvider.html5Mode(true);
  $uiViewScrollProvider.useAnchorScroll()
  $urlRouterProvider.otherwise("/");

  $stateProvider
    .state('home', {
      url: "/",
      templateUrl: "partials/index.html"
    })
    .state('faq', {
      url: "/faq",
      templateUrl: "partials/faq.html"
    })
    .state('demo', {
      url: "/demo",
      templateUrl: "partials/cause.html"
    });
})
.controller("main", function($rootScope, $scope, $http) {
  $scope.cause = {};
  $scope.cause.items = [{placeholder: "Pizza", placeholderPrice: "$20"}, {placeholder: "Soda", placeholderPrice: "$5"}];
  $scope.totalPrice = 0;
  $scope.isFocused = false;
  $scope.isCollapsed = true;
  $scope.loading = false;

  $scope.add = function() {
    $scope.isFocused = false;
    $scope.cause.items.push({});
    setTimeout(function() {
      $scope.$apply(function() {
        $scope.isFocused = true;
      });
    }, 100);
  }

  $scope.remove = function(data) {
    $scope.cause.items.splice(data, 1);
  };

  $scope.$watch("cause.items", function(newValue, oldValue) {
    $scope.totalPrice = 0;
    angular.forEach($scope.cause.items, function(value, key) {
      if(parseFloat(value.price, 10)) {
        $scope.totalPrice += parseFloat(value.price, 10);
      }
    })
  }, true)

  $scope.submit = function() {
    $scope.loading = true;
    $scope.errorMessage = false;
    $http.post('api/cause', $scope.cause)
    .success(function(data) {
      $scope.loading = false;
    })
    .error(function(data) {
      $scope.loading = false;
      $scope.errorMessage = data.message || "You can try refreshing the page.";
    });
  }

  $rootScope.pages = 0;
  $rootScope.$on('$stateChangeStart', function() {
    $rootScope.pages += 1;
    if($rootScope.pages >= 2) {
      $scope.isCollapsed = true;
    }
  })
});