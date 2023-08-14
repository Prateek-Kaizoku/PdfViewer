const url = "../docs/npdf.pdf";
let dialogOpen = false;
let boundingBoxes = [];
let pdfDoc = null,
  pageNum = 1,
  pageIsRendering = false,
  pageNumIsPending = null;
let annotations = {}; // Store annotations by page number

const scale = 1.5,
  canvas = document.querySelector("#pdf-render"),
  ctx = canvas.getContext("2d");

// Render the page
const renderPage = (num) => {
  pageIsRendering = true;
  // hide previous annotations
  Object.values(annotations).forEach((pageAnnotations) => {
    pageAnnotations.forEach((annotation) => {
      annotation.element.style.display = "none";
    });
  });

  // Show annotations for current page
  if (annotations[num]) {
    annotations[num].forEach((annotation) => {
      annotation.element.style.display = "block";
    });
  }

  // Get page
  pdfDoc.getPage(num).then((page) => {
    // Set scale
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderCtx = {
      canvasContext: ctx,
      viewport,
    };

    page.render(renderCtx).promise.then(() => {
      pageIsRendering = false;

      if (pageNumIsPending !== null) {
        renderPage(pageNumIsPending);
        pageNumIsPending = null;
      }
    });

    // Output current page
    document.querySelector("#page-num").textContent = num;
  });
};

// Check for pages rendering
const queueRenderPage = (num) => {
  if (pageIsRendering) {
    pageNumIsPending = num;
  } else {
    renderPage(num);
  }
};

// Show Prev Page
const showPrevPage = () => {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  queueRenderPage(pageNum);
};

// Show Next Page
const showNextPage = () => {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  queueRenderPage(pageNum);
};

// Get Document
pdfjsLib
  .getDocument(url)
  .promise.then((pdfDoc_) => {
    pdfDoc = pdfDoc_;

    document.querySelector("#page-count").textContent = pdfDoc.numPages;

    renderPage(pageNum);
  })
  .catch((err) => {
    // Display error
    const div = document.createElement("div");
    div.className = "error";
    div.appendChild(document.createTextNode(err.message));
    document.querySelector("body").insertBefore(div, canvas);
    // Remove top bar
    document.querySelector(".top-bar").style.display = "none";
  });
function addAnnotation(event) {
  if (dialogOpen) return;
  const rect = canvas.getBoundingClientRect();

  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
    alert("Please add annotations within the bounds of the page.");
    return; // Exit the function if the click is out of bounds
  }
  // Create dialog box
  const dialog = document.createElement("div");
  dialog.className = "annotation-dialog";
  const headingLabel = document.createElement("label");
  headingLabel.textContent = "Headings: ";
  const headingTextarea = document.createElement("textarea");
  headingLabel.appendChild(headingTextarea);
  dialog.appendChild(headingLabel);
  dialogOpen = true;
  // Create comment input field
  const commentLabel = document.createElement("label");
  commentLabel.textContent = "Comments: ";
  const commentTextarea = document.createElement("textarea");
  commentLabel.appendChild(commentTextarea);
  dialog.appendChild(commentLabel);

  const submitButton = document.createElement("button");
  submitButton.textContent = "Submit";
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";

  dialog.appendChild(submitButton);
  dialog.appendChild(cancelButton);
  document.body.appendChild(dialog);

  submitButton.addEventListener("click", function () {
    const region = getRegion(x, y);
    const headingText = headingTextarea.value;
    const commentText = commentTextarea.value;
    const annotationText = `Heading: ${headingTextarea.value}\nComment: ${commentTextarea.value}`;
    if (headingText && commentText) {
      var star = document.createElement("div");
      star.className = "star";
      star.innerHTML = "&#9733;"; // Unicode star character

      // Create annotation element (hidden by default)
      var annotation = document.createElement("div");
      annotation.className = "annotation";
      annotation.textContent = annotationText;
      annotation.style.display = "none";

      // Positioning
      x -= 10; // Centering adjustment
      y -= 10;
      star.style.left = x + "px";
      star.style.top = y + "px";
      document.getElementById("pdf-container").appendChild(star);
      star.appendChild(annotation);

      // Show annotation on hover
      star.addEventListener("mouseover", function () {
        annotation.style.display = "block";
      });
      star.addEventListener("mouseout", function () {
        annotation.style.display = "none";
      });

      // Store the annotation for the current page
      if (!annotations[pageNum]) {
        annotations[pageNum] = [];
      }
      annotations[pageNum].push({
        heading: headingText,
        comment: commentText,
        element: star,
        x: x,
        y: y,
        region: region,
      });
    }
    // Remove dialog box
    document.body.removeChild(dialog);
    dialogOpen = false;
  });

  cancelButton.addEventListener("click", function () {
    // Remove dialog box without saving
    document.body.removeChild(dialog);
    dialogOpen = false;
  });
}

function generateComments() {
  pdfDoc.getMetadata().then((metadata) => {
    let title = metadata.info.Title;

    // Replace any characters that are not suitable for a filename
    title = title.replace(/[^a-zA-Z0-9 \-_]+/g, "");

    // Concatenate the date to the title
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}`;
    const filename = `${title}_${formattedDate}.txt`;

    var commentsText = "";
    Object.keys(annotations).forEach((page) => {
      commentsText += `Page ${page}:\n`;
      annotations[page].forEach((annotation) => {
        commentsText += `for topic "${annotation.heading}" Reviewer said "${annotation.comment}" (ref. ${annotation.region},${annotation.y})\n`;
      });
    });

    var blob = new Blob([commentsText], { type: "text/plain;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  });
}

document.querySelector("#tess-button").addEventListener("click", function () {
  // Clear previous bounding boxes
  boundingBoxes = [];

  Tesseract.recognize(canvas, "eng", { logger: (m) => console.log(m) })
    .then(({ data: { lines } }) => {
      // Use paragraphs instead of blocks
      lines.forEach((line, index) => {
        // Get the bounding box for the paragraph
        const {
          bbox: { x0, y0, x1, y1 },
        } = line;

        // Check if the paragraph is likely bold using a criterion, e.g., confidence
        const isBold = line.confidence > 90; // You may need to adjust this threshold

        // Draw the bounding box on the canvas
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.lineWidth = 2;
        ctx.strokeStyle = isBold ? "black" : "red"; // Set color based on boldness
        ctx.stroke();

        // Draw the serial number inside the box
        ctx.fillStyle = "blue";
        ctx.fillText(index + 1, x0 + 5, y0 + 15);

        // Store the bounding box for later use
        boundingBoxes.push({
          x0,
          y0,
          x1,
          y1,
          number: index + 1,
          text: line.text, // Store the paragraph text
        });
      });

      // If you want to log the extracted paragraphs to the console:
      lines.forEach((line, index) => {
        console.log(`Paragraph ${index + 1}:`, line.text);
      });
    })
    .catch((err) => console.error(err));
});

canvas.addEventListener("mousemove", function (event) {
  const x = event.clientX - canvas.getBoundingClientRect().left;
  const y = event.clientY - canvas.getBoundingClientRect().top;

  // Check if the mouse is inside any of the bounding boxes
  for (const box of boundingBoxes) {
    if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) {
      // Display tooltip with the box number (or you can customize this part as needed)
      canvas.title = `Box Number: ${box.number}`;
      return;
    }
  }

  // Clear tooltip if not hovering over any box
  canvas.title = "";
});

function getRegion(x, y) {
  const numRows = 4;
  const numCols = 2;
  const rowHeight = canvas.height / numRows;
  const colWidth = canvas.width / numCols;

  const rowNumber = Math.floor(y / rowHeight) + 1; // Row number starts from 1
  const colLetter = x < colWidth ? "L" : "R"; // Left if x < colWidth, right otherwise

  return `${rowNumber}${colLetter}`;
}

// Example usage
canvas.addEventListener("click", function (event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const region = getRegion(x, y);

  console.log(`Clicked region: ${region}`); // Will print the region name
});

document.getElementById("uploadButton").addEventListener("click", () => {
  const fileInput = document.getElementById("fileUpload");
  const file = fileInput.files[0];

  if (file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const newUrl = e.target.result;

      // Update the PDF document with the new URL
      pdfjsLib
        .getDocument(newUrl)
        .promise.then((pdfDoc_) => {
          pdfDoc = pdfDoc_;
          document.querySelector("#page-count").textContent = pdfDoc.numPages;

          // Reset annotations and page number
          annotations = {};
          pageNum = 1;
          renderPage(pageNum);
        })
        .catch((err) => console.error(err));
    };

    reader.readAsDataURL(file);
  } else {
    alert("Please select a PDF file to upload.");
  }
});

// Button Events
document.querySelector("#prev-page").addEventListener("click", showPrevPage);
document.querySelector("#next-page").addEventListener("click", showNextPage);
document
  .querySelector("#generate-comments")
  .addEventListener("click", generateComments);
