$("#home-btn").addClass("active");
$(".popup").hide();

const addForm = $("#add-form");

const limit = 10;
let offset = 0;

addForm.on("submit", function (evt) {
    evt.preventDefault();

    let formData = addForm.serializeArray();
    const data = new FormData();

    for (let i = 0; i < formData.length; i++) {
        data.append(formData[i].name, formData[i].value);
    }
    
    $.ajax({
        url: `http://localhost${addForm.attr("action")}`,
        type: "PUT",
        data: data,
        processData: false,
        contentType: false
    })
        .done(function (result) {
            alert(result.message);
            showAddMenu(addForm.attr("action") === "/items");
        })
    return false; // To avoid actual submission of the form
});

function deleteItem() {
    $("#sure").show();
    $("#popup-no").on("click", function () {
        $("#sure").hide();
        return false;
    });
    $("#popup-yes").on("click", function () {
        $.ajax({
            url: `/items/${$("#item-id").text()}`,
            type: "DELETE"
        })
            .done(function (result) {
                alert(result.message);
                showItems();
            })
            .fail(function (result) {
                alert(result.message);
                showItems();
            });
    });
}

function showItems() {
    $("#item, #location, #add-menu, .navbar-bottom, .popup").hide();
    $("#results").show();
    $.ajax({
        url: "/items",
        type: "GET",
        dataType: "json",
        data: {limit: limit, offset: offset},
    })
        .done(function (result) {
            $(".active").removeClass("active");
            $("#items-btn").addClass("active");
            $("#result-count").html(`found ${result.length} items`);
            $("#result-list").empty();
            $.each(result, function (i, item) {
                $("#result-list").append(`
                    <li id="${item.itemID}" onclick="showItem(${item.itemID})">
                        ${generateImage(item.image)}
                        <span id="name">${item.itemName}<br></span>
                        <span id="id">ID: ${item.itemID}<br></span>
                        <span id="location"><a onclick="showLocation(item.locationID)">Location: ${item.locationName}</a></span>
                    </li>
                `);
            })
        })
        .fail(function (result) {
            alert(result.message);
        });
    return false;//Returning false prevents the event from continuing up the chain
}

function showAddMenu(type) {
    if (type) {
        $(".location-field, .amount-field").show();
        addForm.attr("action", "/items");
        $("#name").attr("name", "itemName")
    } else {
        $(".location-field, .amount-field").hide();
        addForm.attr("action", "/locations");
        $("#name").attr("name", "locationName")
    }
    $(".active").removeClass("active");
    $("#add-btn").addClass("active");
    $(".results, #item, #location").hide();
    $("#add-menu").show();
    $("#add-popup").hide();
}