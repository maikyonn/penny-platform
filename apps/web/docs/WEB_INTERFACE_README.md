# 🌐 Influencer Search Web Interface

Beautiful, modern web interface for searching Instagram influencers with advanced semantic search capabilities.

## ✨ Features

- **🎯 Advanced Search**: Semantic, keyword, and hybrid search modes
- **🏷️ Category Search**: Pre-defined categories (fashion, tech, food, etc.)
- **👥 Similar Discovery**: Find accounts similar to any reference influencer
- **📊 Rich Data Display**: Complete influencer profiles with engagement metrics
- **🎨 Modern UI**: Tailwind CSS with responsive design
- **⚡ Real-time Search**: Fast, interactive search with instant results

## 🚀 Quick Start

1. **Start the web server**:
```bash
python start_web.py
```

2. **Open your browser** and go to:
```
http://localhost:5000
```

3. **Upload your data** (first time only):
   - Click "Upload Data" in the navigation
   - Click "Upload and Process Data" button
   - Wait for processing to complete (2-5 minutes)

4. **Start searching**:
   - Use the search tabs for different search types
   - Try quick category buttons
   - Explore similar influencer discovery

## 🎨 Interface Overview

### Main Search Page
- **General Search**: Free-form text search with filters
- **Category Search**: Predefined categories with location filters
- **Similar Search**: Find accounts similar to any reference account
- **Quick Categories**: One-click category searches

### Search Results Display
Each influencer card shows:
- **Profile Info**: Username, display name, profile avatar
- **Key Metrics**: Followers, engagement rate, relevance score, quality score
- **Biography**: Full bio text with hashtags
- **Category & Location**: Business category and address tags
- **Actions**: Find similar accounts, view Instagram profile

### Upload Interface
- **Status Check**: Shows if database is ready
- **Process Monitoring**: Real-time upload progress
- **Requirements**: Clear data format requirements

## 🔍 Search Types Explained

### General Search
```
Example: "fashion bloggers NYC"
```
- Uses natural language processing
- Combines semantic understanding with keyword matching
- Filters by followers, engagement, location

### Category Search
```
Categories: fashion, beauty, food, tech, fitness, travel, lifestyle
```
- Optimized searches for specific niches
- Location filtering available
- Higher follower thresholds for quality

### Similar Search
```
Input: Any username (without @)
```
- Finds accounts with similar content and audience
- Uses semantic similarity of profiles and posts
- Great for competitive analysis

## 📊 Scoring System

Each influencer gets multiple scores:

- **Overall Score**: Composite relevance score (0-100%)
- **Relevance Score**: How well content matches search query
- **Quality Score**: Engagement quality and account metrics
- **Engagement Rate**: Average post engagement percentage

## 🎯 Search Tips

### For Best Results:
1. **Use descriptive terms**: "fashion style blogger" vs just "fashion"
2. **Include context**: "tech review gadgets" vs "tech"
3. **Try different methods**: Switch between semantic and keyword search
4. **Use filters**: Location and follower filters improve relevance

### Search Method Guide:
- **Hybrid** (recommended): Best overall results
- **Semantic**: Better for concept-based searches
- **Keyword**: Better for exact term matching

## 📱 Mobile Responsive

The interface is fully responsive and works great on:
- Desktop computers
- Tablets  
- Mobile phones
- Touch devices

## 🔧 Technical Details

### Built With:
- **Backend**: Flask (Python)
- **Frontend**: Tailwind CSS + Alpine.js
- **Database**: LanceDB vector database
- **Search**: Hybrid semantic + full-text search
- **Icons**: Font Awesome

### Performance:
- **Search Speed**: Sub-second response times
- **Concurrent Users**: Supports multiple simultaneous searches
- **Data Scale**: Handles 100K+ influencer profiles efficiently

### Browser Support:
- Chrome/Edge/Safari (modern versions)
- Firefox (modern versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🛠️ Development

### File Structure:
```
/templates/
  ├── base.html          # Base template with navigation
  ├── index.html         # Main search interface  
  └── upload.html        # Data upload page

app.py                   # Flask web application
start_web.py            # Startup script
```

### Adding New Features:
1. **New Search Types**: Add routes in `app.py` and UI in templates
2. **UI Improvements**: Modify Tailwind classes in templates
3. **Data Fields**: Update result display in `index.html`

### API Endpoints:
- `POST /search` - General search
- `POST /category` - Category search  
- `POST /similar` - Similar account search
- `POST /upload-data` - Data upload

## 🎨 Customization

### Colors & Branding:
Edit the Tailwind config in `base.html`:
```javascript
colors: {
    'brand': {
        50: '#f0f9ff',   // Light background
        500: '#0ea5e9',  // Primary color
        600: '#0284c7',  // Hover states
        700: '#0369a1'   // Active states
    }
}
```

### Quick Categories:
Modify the category buttons in `index.html` to match your data:
```html
<button @click="quickSearch('your-category')">
    <i class="fas fa-icon mr-2"></i>Your Category
</button>
```

## 🚨 Troubleshooting

### Common Issues:

**"Search engine not initialized"**
- Make sure you've uploaded data first
- Check that `snap_data_lancedb` directory exists

**"No results found"**
- Try broader search terms
- Lower the minimum follower count
- Check spelling and try different keywords

**Upload fails**
- Ensure `Snap Data.csv` is in the correct directory
- Check that the CSV has the required columns
- Make sure you have enough disk space

**Slow performance**
- Check available RAM (database loads into memory)
- Try limiting search results
- Restart the web server

### Getting Help:
1. Check the browser console for JavaScript errors
2. Look at the terminal output for Python errors
3. Verify data format matches requirements
4. Try the command-line interface for debugging

## 🎉 Success Tips

1. **Start with broad searches** to understand your data
2. **Use the similar search** to find account clusters  
3. **Apply location filters** for geo-targeted searches
4. **Check engagement rates** for authentic influence
5. **Save interesting accounts** for reference searches

The web interface makes it easy to explore your influencer data and discover relevant accounts for any campaign or analysis!