//
// Bars chart
//

var BarsChart = (function () {

	//
	// Variables
	const labels = Utils.months({ count: 7 });
	//

	var $chart = $('#chart-bars');


	//
	// Methods
	//

	// Init chart
	function initChart($chart) {

		// Create chart
		var ordersChart = new Chart($chart, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [{
					label: 'Sales',
					data: [25, 20, 30, 22, 17, 29]
				}]
			}
		});

		// Save to jQuery object
		$chart.data('chart', ordersChart);
	}


	// Init chart
	if ($chart.length) {
		initChart($chart);
	}

})();
