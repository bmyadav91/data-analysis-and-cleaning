// --------------------upload file handling drag and drop and file selection-----------------------------

// Get references to elements
const formContainer = document.querySelector('.upload-area');
const fileInput = document.getElementById('file');

// Prevent default behaviors for drag and drop events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    formContainer.addEventListener(eventName, e => e.preventDefault());
    formContainer.addEventListener(eventName, e => e.stopPropagation());
});

// Highlight the drop area on dragover
formContainer.addEventListener('dragover', () => {
    formContainer.classList.add('drag-over');
});

// Remove highlight when dragging leaves or after a drop
['dragleave', 'drop'].forEach(eventName => {
    formContainer.addEventListener(eventName, () => {
        formContainer.classList.remove('drag-over');
    });
});

// Handle file drop
formContainer.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (!files) return;
    triggerDataInsights(files[0]);
});

// Handle file selection through the input element
fileInput.addEventListener('change', e => {
    const files = e.target.files;
    if (!files) return;
    triggerDataInsights(files[0]);
});


// Main function to handle file upload and dispatch to specific parsers
async function handleFileUpload(file) {
    if (!file) {
        const errorMessage = 'No file provided for parsing.';
        ErrorDisplay(errorMessage);
        throw new Error(errorMessage);
    }

    // if file size is big 
    size_in_mb = file.size / (1024 * 1024); // Convert bytes to MB
    max_size_in_mb = .6;
    if (size_in_mb > max_size_in_mb) {
        const errorMessage = `The file size is big. Your computer might not handle this.`;
        ErrorDisplay(errorMessage, '#E4A11B');
    }
    // clean .dynamic_container 
    const dynamicContainer = document.querySelector('.dynamic_container');
    if (dynamicContainer) {
        dynamicContainer.innerHTML = '';
    }

    FileNameUpdate(file.name);
    const fileExtension = file.name.split('.').pop().toLowerCase();

    try {
        switch (fileExtension) {
            case 'csv':
                return await parseCSV(file);
            case 'xls':
            case 'xlsx':
                return await parseExcel(file);
            case 'json':
                return await parseJSON(file);
            default:
                const unsupportedMessage = 'Unsupported file type! Allow only CSV, XLS, XLSX, JSON.';
                ErrorDisplay(unsupportedMessage);
                throw new Error(unsupportedMessage);
        }
    } catch (error) {
        console.error('Error in handleFileUpload:', error.message);
        ErrorDisplay(error.message);
        throw error;
    }
}

// trigger data insights 
async function triggerDataInsights(file) {
    try {
        const df = await handleFileUpload(file);

        const SampleDataTableDetails = {
            AccordionTitle: 'Your Sample Data (Wihout Clean)',
            TableElementID: 'SampleDataTableOld',
            Position: 0
        }
        SampleData(df, SampleDataTableDetails);

        const StaticsDataTableDetails = {
            AccordionTitle: 'Your Statistics Data (Wihout Clean)',
            TableElementID: 'StatisticsDataTableOld',
            Position: 1
        }
        const PlotDetails = {
            AccordionTitle: 'Plots For Your Data (Wihout Clean)',
            plotElementID: 'PlotOldDataOld',
            Position: 2 // During the initial iteration of ColumnsIteration, the `.dynamic_container` contains only 1 element, but we are trying to place 2 indexes. As a result, the content will be appended below once the ColumnsIteration is complete. When ColumnsIteration reaches the StatisticsInfoTable, two elements will be present in the `.dynamic_container`: the sample and the plot element. Consequently, the StatisticsInfoTable will be inserted in the 1 index position.
        }
        // The function contains | Plots Creation | Statistics Info Table Creation
        ColumnsIteration(df, StaticsDataTableDetails, PlotDetails, CreateColumnsAsTab=false);

    } catch (error) {
        ErrorDisplay(error.message);
    }
}

// Parse CSV file
async function parseCSV(file) {
    try {
        // Return a promise to handle the async flow
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    try {
                        if (results.errors.length) {
                            ErrorDisplay(results.errors);
                            reject('CSV parsing errors');
                            return;
                        }
                        const data = results.data;
                        if (!data || !data.length) {
                            ErrorDisplay('CSV file contains no data or is corrupted.');
                            reject('No valid data');
                            return;
                        }
                        resolve(new dfd.DataFrame(data));
                    } catch (error) {
                        ErrorDisplay(error.message);
                        reject(error);
                    }
                },
                error: function (error) {
                    ErrorDisplay(error.message);
                    reject(error);
                }
            });
        });
    } catch (error) {
        ErrorDisplay(error.message);
        throw error;
    }
}

// Parse Excel file
async function parseExcel(file) {
    try {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    if (!sheet) {
                        ErrorDisplay('Excel file is empty or corrupted.');
                        reject('Excel sheet not found');
                        return;
                    }
                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                    if (!jsonData || !jsonData.length) {
                        ErrorDisplay('Excel file contains no data.');
                        reject('No valid data');
                        return;
                    }
                    resolve(new dfd.DataFrame(jsonData));
                } catch (error) {
                    ErrorDisplay(error.message);
                    reject(error);
                }
            };

            reader.onerror = function (error) {
                ErrorDisplay(error.message);
                reject(error);
            };

            reader.readAsArrayBuffer(file);
        });
    } catch (error) {
        ErrorDisplay(error.message);
        throw error;
    }
}


// Parse JSON file
async function parseJSON(file) {
    try {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = e.target.result;
                    const jsonData = JSON.parse(data);
                    if (!jsonData || !Array.isArray(jsonData) || !jsonData.length) {
                        ErrorDisplay('JSON file is empty or invalid.');
                        reject('Invalid JSON data');
                        return;
                    }
                    resolve(new dfd.DataFrame(jsonData));
                } catch (error) {
                    ErrorDisplay(error.message);
                    reject(error);
                }
            };

            reader.onerror = function (error) {
                ErrorDisplay(error.message);
                reject(error);
            };

            reader.readAsText(file);
        });
    } catch (error) {
        ErrorDisplay(error.message);
        throw error;
    }
}


// get sample data 
async function SampleData(df, SampleDataTableDetails) {
    try {
        const sampleData = df.head(5);

        // Safely extract data
        const data = {
            columns: sampleData.columns || [],
            rows: sampleData.values || [],
            num_rows: df.shape[0] || 0,
            num_cols: sampleData.columns ? sampleData.columns.length : 0
        };

        // Create the table with the provided data
        CreateSampleDataTable(data, SampleDataTableDetails);
    } catch (error) {
        console.error('Error getting sample data:', error.message);
        alert('An error occurred while retrieving sample data. Please check your input and try again.');
    }
}


// Function to append statistics to the table
async function ColumnsIteration(df, StaticsDataTableDetails, PlotDetails, CreateColumnsAsTab=false) {
    try {
        const stats = [];
        const totalColumns = df.columns.length;

        if (totalColumns === 0) {
            ErrorDisplay('No columns found in the DataFrame.');
            return;
        }

        for (let i = 0; i < totalColumns; i++) {
            const column = df.columns[i];
            const series = df[column];
            const columnStats = {};

            // Data type  
            try {
                columnStats.DataType = series.dtype;
            } catch {
                columnStats.DataType = 'Unable to Get';
            }

            // Na count 
            try {
                columnStats.NaCount = FindNaCount(series);
            } catch {
                columnStats.NaCount = 'Unable to calculate';
            }

            // Unique count 
            try {
                columnStats.UniqueCount = series.unique().values.length;
            } catch (error) {
                columnStats.UniqueCount = 'Unable to get';
            }

            // Top 3 unique values
            try {
                const TopUniqueValue = series.unique().values.slice(0, 3).join(', ') + '...';
                columnStats.TopUniqueValue = TopUniqueValue;
            } catch (error) {
                columnStats.TopUniqueValue = 'Unable to get';
            }

            // Mode (most common value)
            try {
                columnStats.ModeValue = FindMode(series);
            } catch {
                columnStats.ModeValue = 'Unable to get';
            }

            // Mean (average)
            try {
                columnStats.MeanValue = FindMean(series);
            } catch (error) {
                columnStats.MeanValue = NaN;
            }

            // Standard deviation
            try {
                columnStats.std = series.std().toFixed(5);
            } catch (error) {
                columnStats.std = NaN;
            }

            // Min value
            try {
                columnStats.MinValue = FindMin(series);
            } catch {
                columnStats.MinValue = NaN;
            }

            // quantile 
            try {
                columnStats.Quantile = FindQuantile(series);
            } catch {
                columnStats.Quantile = NaN;
            }

            // Max value
            try {
                columnStats.MaxValue = FindMax(series);
            } catch {
                columnStats.MaxValue = NaN;
            }

            stats.push(columnStats);

            // create plot for each column that able to plot 
            CreatePlotData(series, PlotDetails);

            // Update progress bar
            const progress = ((i + 1) / totalColumns) * 100;
            ProgressBar(progress, 'Parsing...');
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        // Prepare the data for table creation
        const tableData = {
            columns: df.columns,
            stats: stats
        };


        // Append the statistics to the table
        CreateDataInfoTable(tableData, StaticsDataTableDetails);

        // create columns as tab if CreateColumnsAsTab is true 
        if (CreateColumnsAsTab) {
            CreateColumnAsTableAccordion(df.columns);
        }

        // Update progress bar
        ProgressBar(100, 'Parsing...', true);

    } catch (error) {
        console.error('Error while appending statistics to table:', error.message);
    }
}

// find missing value count 
function FindNaCount(series) {
    count = 0;
    try {
        for (let i = 0; i < series.shape[0]; i++) {
            const val = series.iloc([i]).values[0];
            if (val === null || val === undefined || val === '') {
                count++;
            }
        }
    } catch {

    }
    return count;
}

// find mean value 
function FindMean(series) {
    try {
        if (['int64', 'float64', 'int32', 'float32'].includes(series.dtype)) {
            let sum = 0;
            let count = 0;

            for (let i = 0; i < series.shape[0]; i++) {
                const val = series.iloc([i]).values[0];
                const numVal = typeof val === 'string' ? parseFloat(val) : val;
                if (typeof numVal === 'number' && !isNaN(numVal) && isFinite(numVal)) {
                    sum += numVal;
                    count++;
                }
            }
            if (count === 0) return NaN;

            average = sum / count;
            if (average % 1 === 0) {
                return average;
            } else {
                return average.toFixed(3);
            }
        } else {
            return NaN;
        }
    } catch {
        return NaN;
    }
}

// find mode value 
function FindMode(series, k = 3) {
    try {
        if (series.dtype === 'int64' || series.dtype === 'float64' || series.dtype === 'int32' || series.dtype === 'float32') {
            const modeSeries = series.mode();
            if (modeSeries.empty) {
                return 'No mode found';
            } else {
                if (k === 0) {
                    return modeSeries[0];
                }
                if (modeSeries.length > 1) {
                    return modeSeries.slice(0, k).join(', ') + '...';
                } else {
                    return modeSeries[0];
                }
            }
        } else {
            const counts = {};
            for (let i = 0; i < series.shape[0]; i++) {
                const value = series.iloc([i]).values[0];
                counts[value] = (counts[value] || 0) + 1;
            }

            let maxCount = 0;
            let modes = [];

            for (const value in counts) {
                if (counts[value] > maxCount) {
                    maxCount = counts[value];
                    modes = [value];
                } else if (counts[value] === maxCount) {
                    modes.push(value);
                }
            }

            if (Object.keys(counts).length === 0) {
                return "No values in series";
            }

            if (k === 0) {
                return modes[0];
            }

            if (modes.length > 1) {
                return modes.slice(0, k).join(', ') + '...';
            } else {
                return modes[0];
            }
        }
    } catch {
        return NaN;
    }
}

// find max value 
function FindMax(series) {
    try {
        let arrayValues = series.values;
        let numericArray = arrayValues.map(value => parseFloat(value)).filter(val => !isNaN(val));

        numericArray.sort((a, b) => a - b);
        let maxValue = numericArray[numericArray.length - 1];

        return maxValue;
    } catch {
        return null;
    }
}

// find min value 
function FindMin(series) {
    try {
        let arrayValues = series.values;
        let numericArray = arrayValues.map(value => parseFloat(value)).filter(val => !isNaN(val));
        numericArray.sort((a, b) => a - b);
        let minValue = numericArray[0];

        return minValue;
    } catch {
        return null;
    }
}


// find quantile value 
function FindQuantile(series) {
    try {
        if (['int64', 'float64', 'int32', 'float32'].includes(series.dtype)) {
            let sortedSeries = series.sortValues();
            let q2 = sortedSeries.median();

            let lowerHalf = sortedSeries.iloc([0, Math.floor((sortedSeries.size - 1) / 2)]);
            let upperHalf = sortedSeries.iloc([Math.ceil((sortedSeries.size) / 2), sortedSeries.size - 1]);

            let q1 = lowerHalf.median();
            let q3 = upperHalf.median();
            return `[25%: ${q1.toFixed(2)}], [50%: ${q2.toFixed(2)}], [75%: ${q3.toFixed(2)}]`;
        } else {
            return NaN;
        }
    } catch {
        return 'Unable to get';
    }
}

// -------------------------------------plot create function-------------------------------------
async function CreatePlotData(column, PlotDetails) {
    try {
        const data = column.values || [];
        const DataLength = data.length || 0;
        const DataType = column.dtype || 'Invalid';
        const ColumnName = column.columns[0] || 'Unable to get Column Name';

        if (DataLength === 0) {
            console.warn(`No data found for column: ${ColumnName}`);
            return;
        }

        const { x, y } = XandYdata(data);
        const uniqueCount = x.length;
        const uniqueRatio = (uniqueCount / DataLength) * 100;

        if (x.length === 0 || y.length === 0) {
            console.warn(`No data found for column: ${ColumnName}`);
            return;
        }

        // If unique ratio is greater than 50%, skip plotting
        if (uniqueRatio > 50) {
            return;
        }

        const layout = {
            title: ColumnName,
            xaxis: { title: ColumnName },
            yaxis: { title: 'Count' },
            width: 595,
        };

        // Determine plot type based on unique count
        let trace;
        if (uniqueCount < 10) {
            trace = { labels: x, values: y, type: 'pie' };
        } else if (uniqueCount >= 10 && uniqueCount <= 30) {
            trace = { x: x, y: y, type: 'bar' };
        } else {
            trace = {
                x: x,
                y: y,
                mode: 'markers',
                type: 'scatter',
                marker: { size: 10 },
                name: ColumnName,
            };
        }

        const isNumeric = ['int64', 'float64', 'int32', 'float32'].includes(DataType);
        if (isNumeric || DataType === 'object' || DataType === 'string') {
            requestAnimationFrame(() => CreatePlotElement(trace, layout, PlotDetails));
        }
    } catch (error) {
        console.warn('Error while creating plot:', error.message);
    }
}



// return data x and y values 
function XandYdata(arr) {
    try {
        const valueCounts = new Map();
        for (const value of arr) {
            valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
        }
        const xValues = Array.from(valueCounts.keys());
        const yValues = Array.from(valueCounts.values());

        return { x: xValues, y: yValues };
    } catch {
        console.error('Error in getting x and y values');
    }
}

// create element for plot 
async function CreatePlotElement(trace, layout, PlotDetails) {
    try {
        const mainElement = document.querySelector('.dynamic_container');
        if (!mainElement) throw new Error('Main element not found.');

        // Helper function to create a plot
        const createPlot = (parent, trace, layout) => {
            const plotChild = document.createElement('div');
            plotChild.classList.add('plot_child');
            parent.appendChild(plotChild);
            requestAnimationFrame(() => {
                Plotly.newPlot(plotChild, [trace], layout, { responsive: true });
            });
        };

        const existingPlotElement = document.getElementById(PlotDetails['plotElementID']);
        if (existingPlotElement) {
            // Append new plot to existing accordion content
            const accordionContent = existingPlotElement.querySelector('.accordion-content');
            if (!accordionContent) throw new Error('Accordion content not found in existing plot element.');
            createPlot(accordionContent, trace, layout);
        } else {
            // Create a new accordion
            const accordion = document.createElement('div');
            accordion.classList.add('accordion', 'graph_accordion');
            accordion.id = PlotDetails['plotElementID'];

            const accordionItem = document.createElement('div');
            accordionItem.classList.add('accordion-item', 'active');

            const accordionHeader = document.createElement('div');
            accordionHeader.classList.add('accordion-header');

            const title = document.createElement('span');
            title.classList.add('title');
            title.textContent = PlotDetails['AccordionTitle'];

            const icon = document.createElement('span');
            icon.classList.add('icon');
            icon.textContent = '-';

            accordionHeader.appendChild(title);
            accordionHeader.appendChild(icon);

            const accordionContent = document.createElement('div');
            accordionContent.classList.add('accordion-content');
            createPlot(accordionContent, trace, layout);

            accordionItem.appendChild(accordionHeader);
            accordionItem.appendChild(accordionContent);
            accordion.appendChild(accordionItem);

            // Append accordion to the main element
            insertChildAtPosition(mainElement, accordion, PlotDetails['Position']);
        }
    } catch (error) {
        console.error(`Error creating plot element: ${error.message}`);
    }
}

// ---------------------------------create column as table --------------------------------------
async function CreateColumnAsTableAccordion(Columns) {
    try {
        // Select the main tag where the accordion will be inserted
        const mainElement = document.querySelector('.dynamic_container');

        // Ensure the main container exists
        if (!mainElement) throw new Error('Main container not found.');

        // Create the accordion structure
        const MainAccordion = document.createElement('div');
        MainAccordion.classList.add('accordion');
        MainAccordion.id = 'ColumnsAsTabAccordion';

        const MainAccordionItem = document.createElement('div');
        MainAccordionItem.classList.add('accordion-item', 'active');

        const MainAccordionHeader = document.createElement('div');
        MainAccordionHeader.classList.add('accordion-header');
        MainAccordionHeader.innerHTML = `
            <span class="title">Clean Your Data</span>
            <span class="icon">-</span>
        `;

        const MainAccordionContent = document.createElement('div');
        MainAccordionContent.classList.add('accordion-content');
        MainAccordionContent.id = 'ColumnsAsTabAccordionContent';

        // Loop through columns and dynamically append content
        for (let i = 0; i < Columns.length; i++) {
            const ColumnName = Columns[i];
            const ValidID = getValidId(ColumnName);
            const ValidName = getValidName(ColumnName);

            const ChildAccordionItem = document.createElement('div');
            ChildAccordionItem.classList.add('accordion-item');

            const ChildAccordionHeader = document.createElement('div');
            ChildAccordionHeader.classList.add('accordion-header');
            ChildAccordionHeader.innerHTML = `
                <span class="title">${ColumnName}</span>
                <span class="icon">+</span>
            `;

            const ChildAccordionContent = document.createElement('div');
            ChildAccordionContent.classList.add('accordion-content');

            ChildAccordionContent.innerHTML = `
                <!-- Handle Missing Values -->
                <div class="handle_container handle_missing">
                    <div class="title">Handle Missing Value:</div>
                    <form class="handle_type">

                        <input type="radio" name="${ValidName}_missing" id="${ValidID}_mode" value="mode_missing" class="mode_missing">
                        <label for="${ValidID}_mode">Mode</label>

                        <input type="radio" name="${ValidName}_missing" id="${ValidID}_mean" value="mean_missing" class="mean_missing">
                        <label for="${ValidID}_mean">Mean</label>

                        <input type="radio" name="${ValidName}_missing" id="${ValidID}_median" value="median_missing" class="median_missing">
                        <label for="${ValidID}_median">Median</label>

                        <input type="text" placeholder="Custom Value" class="custom_value custom_value_missing" id="${ValidID}_custom_value_missing">

                        <input type="radio" name="${ValidName}_missing" id="${ValidID}_remove" value="remove_missing" class="remove_missing">
                        <label for="${ValidID}_remove">Remove</label>

                        <input type="radio" name="${ValidName}_missing" id="${ValidID}_ignore" value="ignore_missing" class="ignore_missing" checked>
                        <label for="${ValidID}_ignore">Ignore</label>

                    </form>
                </div>

                <!-- Handle Outlier Values -->
                <div class="handle_container handle_outlier">
                    <div class="title">Handle Outlier Value:</div>
                    <form class="handle_type">

                        <input type="radio" name="${ValidName}_outlier" id="${ValidID}_mode_outlier" value="mode_outlier" class="mode_outlier">
                        <label for="${ValidID}_mode_outlier">Mode</label>

                        <input type="radio" name="${ValidName}_outlier" id="${ValidID}_mean_outlier" value="mean_outlier" class="mean_outlier">
                        <label for="${ValidID}_mean_outlier">Mean</label>

                        <input type="radio" name="${ValidName}_outlier" id="${ValidID}_median_outlier" value="median_outlier" class="median_outlier">
                        <label for="${ValidID}_median_outlier">Median</label>

                        <input type="text" placeholder="Custom Value" class="custom_value custom_value_outlier" id="${ValidID}_custom_value_outlier">

                        <input type="radio" name="${ValidName}_outlier" id="${ValidID}_remove_outlier" value="remove_outlier" class="_remove_outlier">
                        <label for="${ValidID}_remove_outlier">Remove</label>

                        <input type="radio" name="${ValidName}_outlier" id="${ValidID}_ignore_outlier" value="ignore_outlier" class="ignore_outlier" checked>
                        <label for="${ValidID}_ignore_outlier">Ignore</label>

                    </form>
                </div>

                <!-- Additional Handling -->
                <div class="handle_container">
                    <div class="title">Additional:</div>
                    <div class="handle_type handle_additional">
                        <form class="includes-list">
                            <label class="includes-item" for="${ValidID}_strip_additional">
                                <input type="checkbox" id="${ValidID}_strip_additional"
                                    class="strip_additional">
                                <span class="checkmark"></span>
                                <span>Strip</span>
                            </label>
                            <label class="includes-item" for="${ValidID}_clean_special_characters">
                                <input type="checkbox" id="${ValidID}_clean_special_characters"
                                    class="clean_special_characters_additional">
                                <span class="checkmark"></span>
                                <span>Clean special characters</span>
                            </label>
                        </form>
                    </div>
                </div>
            `;

            // Append the child components properly (fixed)
            ChildAccordionItem.appendChild(ChildAccordionHeader);
            ChildAccordionItem.appendChild(ChildAccordionContent);

            MainAccordionContent.appendChild(ChildAccordionItem);
        }

        // Add button area at the bottom
        const buttonArea = document.createElement('div');
        buttonArea.classList.add('button_area');
        buttonArea.innerHTML = `
            <span class="note">I agree that if there are duplicate rows or columns in my data, they should be removed.</span>
            <button id="process_to_clean" class="custom_btn">Process</button>
        `;

        // Append components together (fixed)
        MainAccordionContent.appendChild(buttonArea);
        MainAccordionItem.appendChild(MainAccordionHeader);
        MainAccordionItem.appendChild(MainAccordionContent);

        MainAccordion.appendChild(MainAccordionItem);

        // Insert accordion into main container
        insertChildAtPosition(mainElement, MainAccordion, 3);

    } catch (error) {
        console.error(`Error creating accordion: ${error.message}`);
    }
}



// return valid element id 
function getValidId(input) {
    let validId = input.trim();

    // Replace spaces and special characters with hyphens
    validId = validId.replace(/[^a-zA-Z0-9_\u00C0-\uFFFF-]+/g, '-');

    // Ensure the ID doesn't start with a digit
    if (/^\d/.test(validId)) {
        validId = `id-${validId}`;
    }

    // Remove multiple hyphens
    validId = validId.replace(/-+/g, '-');

    // Ensure it doesn't end with a hyphen
    validId = validId.replace(/-$/, '');

    // Return the valid ID
    return validId || 'default-id';
}

// return valid inout name 
function getValidName(input) {
    let validName = input.trim();

    // Replace invalid characters with underscores
    validName = validName.replace(/[^a-zA-Z0-9_\u00C0-\uFFFF-]+/g, '_');

    // Remove multiple underscores
    validName = validName.replace(/_+/g, '_');

    // Ensure it doesn't start or end with an underscore
    validName = validName.replace(/^_+|_+$/g, '');

    return validName || 'default_name';
}

// create sample data table 
async function CreateSampleDataTable(TableData, SampleDataTableDetails) {
    try {
        const mainElement = document.querySelector('.dynamic_container');
        if (!mainElement) throw new Error('Main element not found.');

        // Create the accordion structure
        const accordion = document.createElement('div');
        accordion.classList.add('accordion');
        accordion.id = SampleDataTableDetails['TableElementID'];

        // Create the accordion item (section)
        const accordionItem = document.createElement('div');
        accordionItem.classList.add('accordion-item', 'active');

        // Create the accordion header
        const accordionHeader = document.createElement('div');
        accordionHeader.classList.add('accordion-header');

        const title = document.createElement('span');
        title.classList.add('title');
        title.textContent = SampleDataTableDetails['AccordionTitle'];

        const icon = document.createElement('span');
        icon.classList.add('icon');
        icon.textContent = '-';
        accordionHeader.appendChild(title);
        accordionHeader.appendChild(icon);

        // Create the accordion content (table container)
        const accordionContent = document.createElement('div');
        accordionContent.classList.add('accordion-content');

        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.classList.add('table-container');

        // Create the table
        const table = document.createElement('table');

        // Create the table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        TableData.columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);

        // Create the table body
        const tbody = document.createElement('tbody');

        TableData.rows.forEach(row => {
            const tr = document.createElement('tr');

            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        // Append the table to the table container
        tableContainer.appendChild(table);

        // Append the table container to the accordion content
        accordionContent.appendChild(tableContainer);

        // Create the data shape element
        const dataShape = document.createElement('div');
        dataShape.classList.add('data_shape');
        dataShape.textContent = `(Rows: ${TableData.num_rows}, Cols: ${TableData.num_cols})`;

        // Append the data shape to the accordion content
        accordionContent.appendChild(dataShape);

        // Append the accordion header and content to the accordion item
        accordionItem.appendChild(accordionHeader);
        accordionItem.appendChild(accordionContent);

        // Append the accordion item to the accordion structure
        accordion.appendChild(accordionItem);

        // Append the accordion to the main element
        insertChildAtPosition(mainElement, accordion, SampleDataTableDetails['Position']);
    } catch (error) {
        console.error('Error creating sample data table:', error.message);
    }
}



// create data info table 
async function CreateDataInfoTable(TableData, StaticsDataTableDetails) {
    try {
        const mainElement = document.querySelector('.dynamic_container');
        if (!mainElement) throw new Error('Main element not found.');

        // Create the accordion structure
        const accordion = document.createElement('div');
        accordion.classList.add('accordion');
        accordion.id = StaticsDataTableDetails['TableElementID'];

        // Create the accordion item (section)
        const accordionItem = document.createElement('div');
        accordionItem.classList.add('accordion-item', 'active');

        // Create the accordion header
        const accordionHeader = document.createElement('div');
        accordionHeader.classList.add('accordion-header');

        const title = document.createElement('span');
        title.classList.add('title');
        title.textContent = StaticsDataTableDetails['AccordionTitle'];

        const icon = document.createElement('span');
        icon.classList.add('icon');
        icon.textContent = '-';

        accordionHeader.appendChild(title);
        accordionHeader.appendChild(icon);

        // Create the accordion content (table container)
        const accordionContent = document.createElement('div');
        accordionContent.classList.add('accordion-content');

        const tableContainer = document.createElement('div');
        tableContainer.classList.add('table-container');

        // Create the table
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // Create table headers (first row)
        const headerRow = document.createElement('tr');
        const firstHeaderCell = document.createElement('th');
        firstHeaderCell.textContent = "Columns";
        headerRow.appendChild(firstHeaderCell);


        const statNames = Object.keys(TableData.stats[0]);
        // create table headers as stat names 
        statNames.forEach(statName => {
            const th = document.createElement('th');
            th.textContent = statName;
            headerRow.appendChild(th);
        })
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table rows for statistics
        TableData.columns.forEach((column, columnIndex) => {
            const row = document.createElement('tr');
            const columnNameCell = document.createElement('td');
            columnNameCell.textContent = column;
            row.appendChild(columnNameCell);

            statNames.forEach(statName => {
                const cell = document.createElement('td');
                let cellValue = TableData.stats[columnIndex][statName];
                cell.textContent = cellValue;
                if (statName === 'Quantile') {
                    cell.classList.add('no-wrap');
                }

                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);
        accordionContent.appendChild(tableContainer);

        // Append the accordion header and content to the accordion item
        accordionItem.appendChild(accordionHeader);
        accordionItem.appendChild(accordionContent);

        // Append the accordion item to the accordion
        accordion.appendChild(accordionItem);


        // Insert this child into HTML at the specified position
        insertChildAtPosition(mainElement, accordion, StaticsDataTableDetails['Position']);

    } catch (error) {
        console.error('Error while creating accordion and appending statistics:', error.message);
    }
}

// insert dynamic html element at position
async function insertChildAtPosition(parent, child, position, id = false) {
    try {
        if (!(parent instanceof HTMLElement)) {
            throw new Error("Parent must be a valid HTML element.");
        }
        if (!(child instanceof HTMLElement)) {
            throw new Error("Child must be a valid HTML element.");
        }
        if (typeof position !== 'number' || position < 0) {
            throw new Error("Position must be a non-negative number.");
        }

        // Check if an element with the provided id exists and remove it
        if (id) {
            const existingElement = document.getElementById(id);
            if (existingElement) {
                existingElement.remove();
            }
        }

        const totalChildren = parent.children.length;

        if (position > totalChildren) {
            console.warn(
                `Specified position (${position}) exceeds total children (${totalChildren}). Appending at the end.`
            );
            parent.appendChild(child);
        } else {
            parent.insertBefore(child, parent.children[position]);
        }

    } catch (error) {
        console.error(`Error inserting child: ${error.message}`);
    }
}



// ---------------------------------------accordion hide show------------------------------------------
document.body.addEventListener('click', (event) => {
    // Check if the clicked element or its parent is an accordion header
    const header = event.target.closest('.accordion-header');
    if (!header) return;

    // Get the parent accordion item
    const item = header.parentNode;
    if (!item.classList.contains('accordion-item')) return;

    // Stop event propagation to prevent triggering parent accordions
    event.stopPropagation();

    // Toggle the current accordion item
    const isActive = item.classList.contains('active');
    item.classList.toggle('active', !isActive);

    // Change the icon based on active state
    const icon = header.querySelector('.icon');
    if (icon) {
        icon.textContent = isActive ? '+' : '-';
    }

});




// ----------------------blank custom value on selection any radio and unselect it-------------------
document.body.addEventListener('input', (event) => {
    const handleContainer = event.target.closest('.handle_container');
    if (!handleContainer) return;

    const radios = handleContainer.querySelectorAll('input[type="radio"]');
    const customValueInput = handleContainer.querySelector('.custom_value');
    const rangeContainer = handleContainer.querySelector('.range_container');

    if (event.target.matches('input[type="radio"]')) {
        if (customValueInput) customValueInput.value = '';
    } else if (event.target.matches('.custom_value')) {
        if (customValueInput && customValueInput.value.trim() !== '') {
            radios.forEach(radio => {
                radio.checked = false;
            });
        }
        if (rangeContainer) rangeContainer.style.display = 'none';
    }
});

// -----------------------------------------error message display--------------------------------------------
const ErrorElement = document.querySelector('.error_message_parent');
const CloseBTN = ErrorElement.querySelector('.close_btn');

if (ErrorElement && CloseBTN) {
    CloseBTN.addEventListener('click', function () {
        ErrorElement.style.display = 'none';
    });
}


// Function to display an error message
async function ErrorDisplay(message, color = 'red', seconds = 5) {
    try {
        const errorElement = document.querySelector('.error_message_parent');

        if (!errorElement) {
            console.warn('Error message parent element not found.');
            return;
        }

        const messageDetails = errorElement.querySelector('.message_details');

        if (!messageDetails) {
            console.warn('Message details element not found inside error message parent.');
            return;
        }

        errorElement.style.display = 'flex';
        messageDetails.innerText = message;
        messageDetails.style.color = color;

        setTimeout(() => {
            errorElement.style.display = 'none';
            messageDetails.innerText = '';
            messageDetails.style.color = 'red';
        }, seconds * 1000);
    } catch (error) {
        console.error('Error displaying the message:', error);
    }
}


// --------------------------------ProgressBar Status--------------------------------------------
async function ProgressBar(width, message = 'Parsing...', Success = false) {
    try {
        const ProgressContainter = document.querySelector('.upload_status_container');
        const Progress = document.getElementById('progress');
        const FileStatus = document.getElementById('fileStatus');

        if (!Progress || !FileStatus || !ProgressContainter) return;
        ProgressContainter.style.display = 'flex';
        FileStatus.textContent = message;

        if (Success) {
            Progress.style.width = '100%';
            Progress.classList.add('success');
            FileStatus.textContent = 'Completed';
        } else {
            Progress.style.width = `${width}%`;
            Progress.classList.remove('success');
            FileStatus.textContent = message;
        }
    } catch (error) {
        ErrorDisplay(error.message);
    }
}


// -----------------------------------------FileNameUpdate--------------------------------------------
async function FileNameUpdate(name) {
    try {
        const FileName = document.getElementById('fileName');
        const Extension = document.querySelector('.file-icon');
        if (!FileName || !Extension) return;

        FileName.textContent = name;
        Extension.textContent = name.split('.').pop();
    } catch (error) {
        console.error('Error in FileNameUpdate:', error);
    }
}


// ----------------------------------prevent form submit default behavior--------------------------------
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const activeElement = document.activeElement;

        // Check if the Enter key was pressed in an input field within a form
        if (activeElement && activeElement.tagName === 'INPUT' && activeElement.closest('form')) {
            event.preventDefault();
        }
    }
});










// ===========================================Process to Clean==============================================

// ----------------------------------process to clean hit button----------------------------------
let CleanedDF = null;

document.body.addEventListener('click', async (event) => {
    if (event.target.id === 'process_to_clean') {
        const file = document.querySelector('.upload-area input[type="file"]').files[0];
        if (!file) {
            ErrorDisplay('No file selected.');
            return;
        }
        try {
            const Columns = {};
            const ColumnsAsTabAccordionContent = document.getElementById('ColumnsAsTabAccordionContent');
            const AllAccordionItems = ColumnsAsTabAccordionContent.querySelectorAll('.accordion-item');
            
            for (let i = 0; i < AllAccordionItems.length; i++) {
                const accordionItem = AllAccordionItems[i];
                const accordionHeader = accordionItem.querySelector('.accordion-header');
                const accordionContent = accordionItem.querySelector('.accordion-content');
            
                const ColumnName = accordionHeader.querySelector('.title').innerText;
                Columns[ColumnName] = {
                    missing_handle: 'ignore_missing',
                    outlier_handle: 'ignore_outlier',
                    additional_handle: {
                        strip: false,
                        clean_special_characters: false
                    }
                };
            
                // Handle missing values
                const HandleMissingContainer = accordionContent.querySelector('.handle_missing');
                const SelectedRadioInHandleMissing = HandleMissingContainer.querySelector('input[type="radio"]:checked');
                if (SelectedRadioInHandleMissing) {
                    Columns[ColumnName].missing_handle = SelectedRadioInHandleMissing.value;
                } else {
                    const customValueMissing = HandleMissingContainer.querySelector('.custom_value_missing').value.trim();
                    Columns[ColumnName].missing_handle = customValueMissing || 'ignore_missing';
                }
            
                // Handle outliers
                const HandleOutlierContainer = accordionContent.querySelector('.handle_outlier');
                const SelectedRadioInHandleOutlier = HandleOutlierContainer.querySelector('input[type="radio"]:checked');
                if (SelectedRadioInHandleOutlier) {
                    Columns[ColumnName].outlier_handle = SelectedRadioInHandleOutlier.value;
                } else {
                    const customValueOutlier = HandleOutlierContainer.querySelector('.custom_value_outlier').value.trim();
                    Columns[ColumnName].outlier_handle = customValueOutlier || 'ignore_outlier';
                }
            
                // Handle additional settings
                const HandleAdditional = accordionContent.querySelector('.handle_additional');
                Columns[ColumnName].additional_handle.strip =
                    HandleAdditional.querySelector('.strip_additional').checked || false;
                Columns[ColumnName].additional_handle.clean_special_characters =
                    HandleAdditional.querySelector('.clean_special_characters_additional').checked || false;
            }

            // Assign CleanedDF globally 
            CleanedDF = await handleFileUpload(file);
            if (!CleanedDF) {
                ErrorDisplay('Error: Cleaned DataFrame is empty.');
                return;
            }
            
            // Process and clean columns with the user settings
            await CleanColumns(CleanedDF, Columns);

        } catch (error) {
            ErrorDisplay(error.message);
        }
    }
});

// -------------------------------------- Clean Columns ----------------------------------
// Clean columns function
async function CleanColumns(df, Columns) {
    try {
        const columnNames = Object.keys(Columns);

        for (let i = 0; i < columnNames.length; i++) {
            const columnName = columnNames[i];
            const columnConfig = Columns[columnName];
            const columnSeries = df[columnName];

            // Handle missing values
            if (columnConfig.missing_handle === 'mode_missing') {
                // console.log('Before Cleaned NaCount', FindNaCount(columnSeries));
                
                // Fill missing values with the provided value ('Test')
                df[columnName] = FillNaValue(df[columnName], '1000.9');
                
                // console.log('After Cleaned NaCount', FindNaCount(df[columnName]));
            }
        }

    } catch (error) {
        console.error(`Error cleaning columns: ${error.message}`);
    }
}

// fill na function 
function FillNaValue(series, value) {
    try {
        // fill null, "", undefined value with value if found 
        for (let i = 0; i < series.length; i++) {
            if (series[i] === null || series[i] === undefined || series[i] === '') {
                series[i] = value;
            }
        }
        // convert to series 
        return new pandas.Series(series);
    } catch (error) {
        console.error(`Error filling na value: ${error.message}`);
    }
        
}

