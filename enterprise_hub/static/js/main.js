document.addEventListener("DOMContentLoaded", function() {
    
    // 1. جلب إحصائيات لوحة التحكم الأساسية (الكروت)
    fetch('/api/dashboard-stats')
        .then(response => response.json())
        .then(data => {
            // تحديث الأرقام في الـ HTML
            // بنستخدم toLocaleString عشان يحط فواصل الآلاف في الفلوس
            document.getElementById('totalRevenue').textContent = data.total_revenue.toLocaleString() + ' ج.م';
            document.getElementById('totalLeads').textContent = data.total_leads;
            document.getElementById('lowStockItems').textContent = data.low_stock_items;
        })
        .catch(error => console.error('Error fetching stats:', error));

    // 2. جلب بيانات العملاء (CRM) ورسمها بيانيا (Doughnut Chart)
    fetch('/api/leads')
        .then(response => response.json())
        .then(data => {
            // تجميع حالات العملاء
            const statusCounts = {};
            data.forEach(lead => {
                statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
            });

            const ctxLeads = document.getElementById('leadsChart').getContext('2d');
            new Chart(ctxLeads, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(statusCounts),
                    datasets: [{
                        data: Object.values(statusCounts),
                        // ألوان متناسقة مع هويتنا: أورنج، أسود، رمادي، وأحمر للمرفوض
                        backgroundColor: ['#ff6600', '#111111', '#888888', '#dc3545'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        });

    // 3. جلب بيانات المنتجات (ERP) ورسمها بيانيا (Bar Chart)
    fetch('/api/products')
        .then(response => response.json())
        .then(data => {
            // تجهيز أسماء المنتجات وكمياتها
            const productNames = data.map(p => p.product_name);
            const stockQuantities = data.map(p => p.stock_quantity);

            const ctxStock = document.getElementById('stockChart').getContext('2d');
            new Chart(ctxStock, {
                type: 'bar',
                data: {
                    labels: productNames,
                    datasets: [{
                        label: 'الكمية في المخزن',
                        data: stockQuantities,
                        backgroundColor: '#111111', // لون العواميد أسود
                        hoverBackgroundColor: '#ff6600', // لون العواميد أورنج عند الوقوف عليها بالماوس
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true }
                    },
                    plugins: {
                        legend: { display: false } // خفينا الـ legend لأن العواميد واضحة
                    }
                }
            });
        });
});