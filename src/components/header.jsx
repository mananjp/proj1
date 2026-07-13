import React from "react";

function Header(props) {
    return (
        <>
            <p>Name: {props.name}</p>
            <p>Branch: {props.branch}</p>
            <p>year: 3rd Year</p>
        </>
    )
}
export default Header;