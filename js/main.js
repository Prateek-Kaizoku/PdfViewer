const url = "../docs/npdf.pdf";
let uploadedPdfBuffer = null;
let scannedPages = [];
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
  handleTessButtonClick();
  queueRenderPage(pageNum);
};

// Show Next Page
const showNextPage = () => {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  handleTessButtonClick();
  queueRenderPage(pageNum);
  const button = document.getElementById("next-page"); //make sure it is the right button!!!

  if (scannedPages.includes(pageNum)) {
    button.style.setProperty("--primary-color", "red");
    // or any color to indicate it's scanned
  } else {
    button.style.setProperty(
      "--primary-color",
      "linear-gradient(90deg, #1e3c72 0%, #2a5298 100%"
    ); // reset to default color
  }
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

// Add annotations functionality

function addAnnotation(event) {
  if (dialogOpen) return;

  const rect = canvas.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
    alert("Please add annotations within the bounds of the page.");
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "annotation-dialog";

  const headingLabel = document.createElement("label");
  headingLabel.textContent = "Headings: ";
  const headingTextarea = document.createElement("textarea");
  headingLabel.appendChild(headingTextarea);
  dialog.appendChild(headingLabel);

  const commentLabel = document.createElement("label");
  commentLabel.textContent = "Comments: ";
  const commentTextarea = document.createElement("textarea");
  commentLabel.appendChild(commentTextarea);
  dialog.appendChild(commentLabel);

  let isDragging = false;
  let offsetX, offsetY;
  dialog.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );
  const startDrag = (event) => {
    isDragging = true;
    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;
    offsetX = clientX - dialog.getBoundingClientRect().left - window.scrollX;
    offsetY = clientY - dialog.getBoundingClientRect().top - window.scrollY;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onMouseMove);
    document.addEventListener("touchend", onMouseUp);
  };

  dialog.addEventListener("mousedown", startDrag);
  dialog.addEventListener("touchstart", startDrag);

  function onMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    dialog.style.left = clientX - offsetX + "px";
    dialog.style.top = clientY - offsetY + "px";
    dialog.style.transform = "none";
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchmove", onMouseMove);
    document.removeEventListener("touchend", onMouseUp);
  }

  const submitButton = document.createElement("button");
  submitButton.textContent = "Submit";
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";

  dialog.appendChild(submitButton);
  dialog.appendChild(cancelButton);
  document.body.appendChild(dialog);
  requestAnimationFrame(() => {
    dialog.classList.add("visible");
  });
  dialogOpen = true;

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
      checkAnnotationsInBoundingBox();
    }
    // Remove dialog box

    // Wait for the transition to complete before actually removing the dialog
    removeDialog(dialog);
  });

  cancelButton.addEventListener("click", function () {
    removeDialog(dialog);
  });
}

function removeDialog(dialog) {
  dialog.classList.remove("visible");
  dialog.addEventListener(
    "transitionend",
    () => {
      dialog.remove();
      dialogOpen = false;
    },
    { once: true }
  );
}

function clearAnnotations() {
  const stars = document.querySelectorAll(".star");
  stars.forEach((star) => star.remove());
  annotations = {}; // Assuming annotations is a global object storing your annotations
  scannedPages = [];
}

// function addAnnotation(event) {
//   if (dialogOpen) return;
//   const rect = canvas.getBoundingClientRect();

//   let x = event.clientX - rect.left;
//   let y = event.clientY - rect.top;

//   if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
//     alert("Please add annotations within the bounds of the page.");
//     return; // Exit the function if the click is out of bounds
//   }

//   // Create dialog box
//   const dialog = document.createElement("div");
//   dialog.className = "annotation-dialog";
//   const headingLabel = document.createElement("label");
//   headingLabel.textContent = "Headings: ";
//   const headingTextarea = document.createElement("textarea");
//   headingLabel.appendChild(headingTextarea);
//   dialog.appendChild(headingLabel);
//   dialogOpen = true;
//   // Create comment input field
//   const commentLabel = document.createElement("label");
//   commentLabel.textContent = "Comments: ";
//   const commentTextarea = document.createElement("textarea");
//   commentLabel.appendChild(commentTextarea);
//   dialog.appendChild(commentLabel);
//   let isDragging = false;
//   let offsetX, offsetY;

//   dialog.addEventListener("mousedown", function (event) {
//     isDragging = true;
//     offsetX =
//       event.pageX - dialog.getBoundingClientRect().left - window.scrollX;
//     offsetY = event.pageY - dialog.getBoundingClientRect().top - window.scrollY;
//     document.addEventListener("mousemove", onMouseMove);
//     document.addEventListener("mouseup", onMouseUp);
//   });

//   function onMouseMove(e) {
//     if (isDragging) {
//       const dialogHeight = dialog.offsetHeight;
//       dialog.style.left = e.clientX - offsetX + "px";
//       dialog.style.top = e.clientY - offsetY - dialogHeight + "px";
//       dialog.style.transform = "none"; // Remove the centering transform
//     }
//   }

//   function onMouseUp() {
//     isDragging = false;
//     document.removeEventListener("mousemove", onMouseMove);
//     document.removeEventListener("mouseup", onMouseUp);
//   }
//   const submitButton = document.createElement("button");
//   submitButton.textContent = "Submit";
//   const cancelButton = document.createElement("button");
//   cancelButton.textContent = "Cancel";

//   dialog.appendChild(submitButton);
//   dialog.appendChild(cancelButton);
//   document.body.appendChild(dialog);
//   requestAnimationFrame(function () {
//     dialog.classList.add("visible"); // Add "visible" class
//   });

// submitButton.addEventListener("click", function () {
//   const region = getRegion(x, y);
//   const headingText = headingTextarea.value;
//   const commentText = commentTextarea.value;
//   const annotationText = `Heading: ${headingTextarea.value}\nComment: ${commentTextarea.value}`;
//   if (headingText && commentText) {
//     var star = document.createElement("div");
//     star.className = "star";
//     star.innerHTML = "&#9733;"; // Unicode star character

//     // Create annotation element (hidden by default)
//     var annotation = document.createElement("div");
//     annotation.className = "annotation";
//     annotation.textContent = annotationText;
//     annotation.style.display = "none";

//     // Positioning
//     x -= 10; // Centering adjustment
//     y -= 10;
//     star.style.left = x + "px";
//     star.style.top = y + "px";
//     document.getElementById("pdf-container").appendChild(star);
//     star.appendChild(annotation);

//     // Show annotation on hover
//     star.addEventListener("mouseover", function () {
//       annotation.style.display = "block";
//     });
//     star.addEventListener("mouseout", function () {
//       annotation.style.display = "none";
//     });

//     // Store the annotation for the current page
//     if (!annotations[pageNum]) {
//       annotations[pageNum] = [];
//     }
//     annotations[pageNum].push({
//       heading: headingText,
//       comment: commentText,
//       element: star,
//       x: x,
//       y: y,
//       region: region,
//     });
//     checkAnnotationsInBoundingBox();
//   }
//   // Remove dialog box
//   removeDialog(dialog);
// });

//   cancelButton.addEventListener("click", function () {
//     // Remove dialog box without saving
//     dialog.classList.remove("visible");

//     // Wait for the transition to complete before actually removing the dialog
//     dialog.addEventListener(
//       "transitionend",
//       function () {
//         document.body.removeChild(dialog);
//         dialogOpen = false;
//       },
//       { once: true }
//     );
//   });
// }

// check if the annotation is in the bounding box.

// function checkAnnotationsInBoundingBox() {
//   const offsetX = 1.5; // Horizontal offset
//   const offsetY = 7.5; // Vertical offset

//   Object.values(annotations).forEach((pageAnnotations) => {
//     pageAnnotations.forEach((annotation) => {
//       const x = annotation.x;
//       const y = annotation.y;
//       let insideBoundingBox = false;
//       let box;
//       for (let i = 0; i < boundingBoxes.length; i++) {
//         box = boundingBoxes[i];
//         if (
//           x >= box.x0 + offsetX &&
//           x <= box.x1 - offsetX &&
//           y > box.y0 - offsetY &&
//           y <= box.y1 - offsetY
//         ) {
//           insideBoundingBox = true;
//           console.log(
//             `Annotation at (${x}, ${y}) is inside bounding box number ${box.number} with offset.`
//           );
//           break; // Exit the loop if a bounding box is found
//         } else {
//           console.log(x, y, box.x0, box.x1, box.y0, box.y1);
//           console.log(
//             `Annotation at (${x}, ${y}) is not inside any bounding box, boxnumber ${box.number} with offset.`
//           );
//         }
//       }
//     });
//   });
// }

function checkAnnotationsInBoundingBox() {
  const offsetX = 1.5; // Horizontal offset
  const offsetY = 7.5; // Vertical offset

  Object.values(annotations).forEach((pageAnnotations) => {
    pageAnnotations.forEach((annotation, index) => {
      // Include the index
      const x = annotation.x;
      const y = annotation.y;
      let insideBoundingBox = false;
      let box;
      for (let i = 0; i < boundingBoxes.length; i++) {
        box = boundingBoxes[i];
        if (
          x >= box.x0 + offsetX &&
          x <= box.x1 - offsetX &&
          y >= box.y0 - offsetY &&
          y <= box.y1 - offsetY
        ) {
          const textContent = box.text; // You'll need to define this function
          const words = textContent.split(/\s+/);
          const firstWord = words.slice(0, 3).join(" ");
          const lastWord = words.slice(-3).join(" ");

          // Store the first and last words with the annotation
          annotation.firstWord = firstWord;
          annotation.lastWord = lastWord;
          insideBoundingBox = true;
          console.log(
            `Annotation at on line ${box.number}. and text is ${box.text}}`
          );
          annotation.boundingBoxNumber = box.number; // Store the bounding box number
          pageAnnotations[index] = annotation; // Update the annotation in the pageAnnotations array
        }
      }
      if (!insideBoundingBox) {
        console.log(
          `Annotation at (${x}, ${y}) is not inside any bounding box.`
        );
      }
    });
  });
}
function generateComments() {
  if (Object.keys(annotations).length === 0) {
    alert("No annotations added!");
    return;
  }
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

    let sortedAnnotations = [];

    // Flatten the annotations and push them to the sortedAnnotations array
    for (let page in annotations) {
      annotations[page].forEach((annotation) => {
        annotation.page = page; // Add the page number to each annotation
        sortedAnnotations.push(annotation);
      });
    }

    // Sort the annotations by page and then by line number
    sortedAnnotations.sort((a, b) => {
      if (a.page === b.page) {
        return a.boundingBoxNumber - b.boundingBoxNumber;
      }
      return a.page - b.page;
    });

    // Generate the comments from the sorted annotations
    let userTemplate = document.getElementById("templateInput").value;

    let commentsText = "";
    let currentPage = null;

    sortedAnnotations.forEach((annotation) => {
      if (currentPage !== annotation.page) {
        commentsText += `Page ${annotation.page}:\n`;
        currentPage = annotation.page;
      }

      // Embed variables into user template
      let customComment = userTemplate
        .replace("{heading}", annotation.heading)
        .replace("{comment}", annotation.comment)
        .replace("{boundingBoxNumber}", annotation.boundingBoxNumber);

      // Append the custom comment and other fixed information
      commentsText += `${customComment} (ref. ${annotation.region} ${annotation.firstWord}...${annotation.lastWord} )\n`;
    });

    // This is just to demonstrate the generated text in this example
    alert(commentsText);

    var blob = new Blob([commentsText], { type: "text/plain;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  });
}

async function stichToPdf() {
  let sortedAnnotations = [];

  for (let page in annotations) {
    annotations[page].forEach((annotation) => {
      annotation.page = page; // Add the page number to each annotation
      sortedAnnotations.push(annotation);
    });
  }
  sortedAnnotations.sort((a, b) => {
    if (a.page === b.page) {
      return a.boundingBoxNumber - b.boundingBoxNumber;
    }
    return a.page - b.page;
  });

  const pdfDoc1 = await PDFLib.PDFDocument.load(uploadedPdfBuffer);
  const [pageWidth, pageHeight] = [600, 800];
  const newPage = pdfDoc1.addPage([pageWidth, pageHeight]);
  let x = 50;
  let y = pageHeight - 100;

  sortedAnnotations.forEach((annotation) => {
    const comment = `Page ${annotation.page}:\nfor topic "${annotation.firstWord}...${annotation.lastWord}" Reviewer said "${annotation.comment} at line number ${annotation.boundingBoxNumber}" (ref. ${annotation.region},${annotation.y})\n`;
    newPage.drawText(comment, {
      x: x,
      y: y,
      size: 10,
      color: PDFLib.rgb(0, 0, 0),
    });
    y -= 50;
  });
  const modifiedPdfBytes = await pdfDoc1.save();

  // Download the modified PDF
  const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "modified.pdf";
  link.click();
}

// function generateComments() {
//   pdfDoc.getMetadata().then((metadata) => {
//     let title = metadata.info.Title;

//     // Replace any characters that are not suitable for a filename
//     title = title.replace(/[^a-zA-Z0-9 \-_]+/g, "");

//     // Concatenate the date to the title
//     const date = new Date();
//     const formattedDate = `${date.getFullYear()}-${
//       date.getMonth() + 1
//     }-${date.getDate()}`;
//     const filename = `${title}_${formattedDate}.txt`;

//     var commentsText = "";
//     Object.keys(annotations).forEach((page) => {
//       commentsText += `Page ${page}:\n`;
//       annotations[page].forEach((annotation) => {
//         // Include the bounding box number with each comment
//         l      });
//     });

//     var blob = new Blob([commentsText], { type: "text/plain;charset=utf-8" });
//     var link = document.createElement("a");
//     link.href = URL.createObjectURL(blob);
//     link.download = filename;
//     link.click();
//   });
// }

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      uploadedPdfBuffer = e.target.result;
    };
    reader.readAsArrayBuffer(file);
  }
}

async function handleTessButtonClick() {
  // Check if the page has already been scanned
  if (scannedPages.includes(pageNum)) {
    checkAnnotationsInBoundingBox();
    console.log(`Page ${pageNum} has already been scanned.`);
    return;
  }
  // Clear previous bounding boxes
  boundingBoxes = [];
  const button = document.getElementById("next-page");

  try {
    const result = await Tesseract.recognize(canvas, "eng", {
      logger: (m) => {
        console.log(m);
        if (m.status === "recognizing text") {
          button.style.setProperty("--primary-color", "green"); // or any other style changes you want
          button.textContent = "Processing...";
        }
      },
    });

    const { lines } = result.data;

    // Use paragraphs instead of blocks
    button.style.setProperty("--primary-color", "red"); // reset to default color
    button.textContent = "Next-Page"; // or whatever the original text was
    lines.forEach((line, index) => {
      // Get the bounding box for the paragraph
      const {
        bbox: { x0, y0, x1, y1 },
      } = line;

      // Check if the paragraph is likely bold using a criterion, e.g., confidence

      // Draw the bounding box on the canvas
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.lineWidth = 0.1;
      ctx.strokeStyle = "red"; // Set color based on boldness
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
    scannedPages.push(pageNum);
    checkAnnotationsInBoundingBox();
  } catch (err) {
    console.error(err);
  }
}

canvas.addEventListener("mousemove", function (event) {
  const x = event.clientX - canvas.getBoundingClientRect().left;
  const y = event.clientY - canvas.getBoundingClientRect().top;

  // Check if the mouse is inside any of the bounding boxes
  for (const box of boundingBoxes) {
    if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) {
      // Display tooltip with the box number (or you can customize this part as needed)
      canvas.title = `Box Number: ${box.number}, Text: ${box.text}, Confidence: ${box.confidence}, Bounding Box: (${box.x0}, ${box.y0}) - (${box.x1}, ${box.y1})`;
      return;
    }
  }

  // Clear tooltip if not hovering over any box
  canvas.title = "";
});

// Get the region name based on the x and y coordinates 1left, 2right, 3left, 4right...

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

// document.getElementById("uploadButton").addEventListener("change", () => {
//   const fileInput = document.getElementById("fileUpload");
//   const file = fileInput.files[0];

//   if (file) {
//     const reader = new FileReader();

//     reader.onload = function (e) {
//       const newUrl = e.target.result;

//       // Update the PDF document with the new URL
//       pdfjsLib
//         .getDocument(newUrl)
//         .promise.then((pdfDoc_) => {
//           pdfDoc = pdfDoc_;
//           document.querySelector("#page-count").textContent = pdfDoc.numPages;

//           // Reset annotations and page number
//           annotations = {};
//           pageNum = 1;
//           renderPage(pageNum);
//         })
//         .catch((err) => console.error(err));
//     };

//     reader.readAsDataURL(file);
//   } else {
//     alert("Please select a PDF file to upload.");
//   }
// });

// Button Events
function toggleTemplateInput() {
  const container = document.getElementById("templateContainer");
  if (container.style.display === "none") {
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

document.getElementById("fileUpload").addEventListener("change", () => {
  clearAnnotations();
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
          handleTessButtonClick();
        })
        .catch((err) => console.error(err));
    };

    reader.readAsDataURL(file);
  } else {
    alert("Please select a PDF file to upload.");
  }
});

document.querySelector("#prev-page").addEventListener("click", showPrevPage);
document.querySelector("#next-page").addEventListener("click", showNextPage);
document
  .querySelector("#generate-comments")
  .addEventListener("click", generateComments);
function showDialog() {
  const dialog = document.querySelector(".annotation-dialog");
  dialog.classList.add("visible");
}

function hideDialog() {
  const dialog = document.querySelector(".annotation-dialog");
  dialog.classList.remove("visible");
}
